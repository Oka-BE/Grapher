import { reactive } from 'vue'
import { Expression, Equation } from '../../../class/mathStructs.js'
import graphWorker from './graphWorker.js?worker'
import { messageType, exprTypes } from './shared.js'

class GraphManager {
    exprs = []
    _redrawCoordinate
    coordinateAFI = null
    _redrawGraph
    graphAFI = null
    freepanelInitCallbacks = []
    getRect
    getView
    drawInfo = {
        step: () => {
            const rect = this.getRect()
            return (rect.width + rect.height) / 2 / 50
        },
        pxGap: () => {
            return 2
        },
    }
    varDefinitions = {}
    functionDefinitions = {}
    functionDefRef = {}
    onWorkerMessage(obj, e) {
        switch (e.data[0]) {
            case messageType.returnGraph: {
                if (e.data[1] === null) {
                    const rect = this.getRect()
                    obj.ctx.clearRect(0, 0, rect.width, rect.height)
                } else {
                    const [xbuffer, ybuffer] = [e.data[1], e.data[2]]
                    const xpointData = Array.from(new Float32Array(xbuffer))
                    const ypointData = Array.from(new Float32Array(ybuffer))
                    this._redrawGraph(obj, xpointData, ypointData)
                }
                obj.workerLocked = false
                if (obj.workerExtra) {
                    obj.workerExtra = false
                    this.redrawGraph(obj)
                }
                break
            }
            case messageType.shareInfo: {
                const info = e.data[1]

                if (obj.varDefinition !== null && !obj.varDefConflict) {
                    if (info.varDefinition === null) {
                        delete this.varDefinitions[obj.varDefinition.name]
                        this.redrawGraphs()
                    } else {
                        if (obj.varDefinition.name === info.varDefinition.name) {
                            this.varDefinitions[info.varDefinition.name] = info.varDefinition.v
                            this.redrawGraphs()
                        } else {
                            delete this.varDefinitions[obj.varDefinition.name]
                            if (this.varDefinitions[info.varDefinition.name] !== undefined) {
                                // TODO: handle conflict
                                obj.varDefConflict = true
                            } else {
                                this.varDefinitions[info.varDefinition.name] = info.varDefinition.v
                                this.redrawGraphs()
                            }
                        }
                    }
                } else {
                    if (info.varDefinition !== null) {
                        if (this.varDefinitions[info.varDefinition.name] !== undefined) {
                            // TODO: handle conflict
                            obj.varDefConflict = true
                        } else {
                            this.varDefinitions[info.varDefinition.name] = info.varDefinition.v
                            this.redrawGraphs()
                        }
                    }
                }

                if (obj.functionDefinition && !obj.functionDefConflict && !obj.functionDef2WayLink) {
                    delete this.functionDefinitions[obj.functionDefinition.name]
                    delete this.functionDefRef[obj.functionDefinition.name]
                }
                if (info.functionDefinition) {
                    obj.functionDefConflict = this.functionDefinitions[info.functionDefinition.name] !== undefined
                    obj.functionDef2WayLink = false
                    for (let i = 0; i < info.functionDefinition.usingFunctionNames.length; i++) {
                        if (this.functionDefRef[info.functionDefinition.usingFunctionNames[i]] && this.functionDefRef[info.functionDefinition.usingFunctionNames[i]].includes(info.functionDefinition.name)) {
                            obj.functionDef2WayLink = true
                            break
                        }
                    }
                    if (!obj.functionDefConflict && !obj.functionDef2WayLink) {
                        this.functionDefinitions[info.functionDefinition.name] = info.functionDefinition.latex
                        this.functionDefRef[info.functionDefinition.name] = info.functionDefinition.usingFunctionNames
                    }
                } else {
                    obj.functionDefConflict = false
                    obj.functionDef2WayLink = false
                }

                if (obj.type === exprTypes.varDefinition || obj.type === exprTypes.functionDefinition || info.type === exprTypes.varDefinition || info.type === exprTypes.functionDefinition) {
                    this.redrawGraphs()
                }


                obj.type = info.type
                obj.valid = info.valid
                obj.extraVars = info.extraVars
                obj.varDefinition = info.varDefinition
                obj.functionDefinition = info.functionDefinition
                break
            }
        }
    }
    pushExpr(expr, color) {
        const obj = {
            type: null,
            init: false,
            expr,
            valid: true,
            extraVars: [],
            color,
            id: Symbol(),
            cvs: null,
            ctx: null,
            worker: null,
            workerLocked: false,
            workerExtra: false,
            varDefinition: null,
            varDefConflict: false,
            functionDefinition: null,
            functionDefConflict: false,
            functionDef2WayLink: false,
        }
        const worker = new graphWorker()
        worker.onmessage = (e) => {
            this.onWorkerMessage(obj, e)
        }
        obj.worker = worker
        this.exprs.push(obj)
    }
    editExpr(index, latex) {
        this.exprs[index].worker.postMessage([messageType.setExpr, latex])
        this.redrawGraph(this.exprs[index])
    }
    removeExpr(index) {
        this.exprs[index].worker.terminate()
        let gobalInfluence = false
        if (this.exprs[index].varDefinition !== null && !this.exprs[index].varDefConflict) {
            delete this.varDefinitions[this.exprs[index].varDefinition.name]
            gobalInfluence = true
        }
        if (this.exprs[index].functionDefinition !== null && !this.exprs[index].functionDefConflict) {
            delete this.functionDefinitions[this.exprs[index].functionDefinition.name]
            gobalInfluence = true
        }
        if (gobalInfluence) {
            this.redrawGraphs()
        }
        this.exprs.splice(index, 1)
    }
    freepanelInit() {
        for (const cb of this.freepanelInitCallbacks) {
            cb()
        }
        this.freepanelInitCallbacks = null
    }
    onFreepanelInit(cb) {
        this.freepanelInitCallbacks.push(cb)
    }
    redrawCoordinate() {
        if (this.coordinateAFI === null) {
            this.coordinateAFI = requestAnimationFrame(() => {
                this._redrawCoordinate()
                this.coordinateAFI = null
            })
        }
    }
    redrawGraph(expr) {
        if (expr.type === exprTypes.functionDefinition || expr.type === exprTypes.varDefinition) {
            return
        }
        if (expr.workerLocked) {
            expr.workerExtra = true
            return
        }
        expr.workerLocked = true

        const view = this.getView()

        const step = this.drawInfo.step() // pixel gap between computed points
        const iterationCount = Math.ceil(step / this.drawInfo.pxGap()) // times of iterations to refine points
        const iterationPadding = 20
        const granularity = 4 // pixel gap between 2 points to find roots

        const innerStep = step / view.pxPerUnit * view.unit
        const innerGranularity = view.unit / view.pxPerUnit * granularity
        const innerMaxGap = view.unit / view.pxPerUnit * 0.5
        const innerIterationPadding = iterationPadding / view.pxPerUnit * view.unit

        expr.worker.postMessage([messageType.computeGraph, [
            view.lowx, view.highx, view.lowy, view.highy,
            innerStep, innerGranularity, innerMaxGap,
            iterationCount, innerIterationPadding,
            Object.entries(this.varDefinitions),
            Object.entries(this.functionDefinitions),
        ]])
    }
    redrawGraphs() {
        for (let i = 0; i < this.exprs.length; i++) {
            this.redrawGraph(this.exprs[i])
        }
    }
    redrawAll() {
        this.redrawCoordinate()
        this.redrawGraphs()
    }
}

const manager = reactive(new GraphManager())
export default manager

// let time = new Date().getTime()
// equ.findRoots(-100000, 100000, 0.1, 0.001)
// console.log(new Date().getTime() - time)
// time = new Date().getTime()
// // 200 * 10 ^ 5
// for (let i = 0; i < 10000 * 200; i++) {
//     equ.lhs.compute({ x: 3 })
// }
// console.log(new Date().getTime() - time)
// time = new Date().getTime()
// for (let i = 0; i < 10000 * 200; i++) {
//     equ.lhs.flatCompute({ x: 3 })
// }
// console.log(new Date().getTime() - time)
// time = new Date().getTime()
// console.log(equ.lhs.flatCompute({ x: 1 }))
// console.log(JSON.stringify(equ.lhs, null, 2))
// equ.form()