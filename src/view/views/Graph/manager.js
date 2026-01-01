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
            return 3
        },
    }
    /**
     * name(key) for value
     */
    varDefinitions = {}
    // name(key) for latex
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

                if (obj.type === exprTypes.varDefinition && !obj.varDefinition.conflict) {
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
                                // handle conflict
                                obj.varDefinition.conflict = true
                            } else {
                                this.varDefinitions[info.varDefinition.name] = info.varDefinition.v
                                this.redrawGraphs()
                            }
                        }
                    }
                } else {
                    if (info.varDefinition !== null) {
                        if (this.varDefinitions[info.varDefinition.name] !== undefined) {
                            // handle conflict
                            obj.varDefinition.conflict = true
                        } else {
                            this.varDefinitions[info.varDefinition.name] = info.varDefinition.v
                            this.redrawGraphs()
                        }
                    }
                }

                if (obj.type === exprTypes.functionDefinition && !obj.functionDefinition.conflict && !obj.functionDefinition.confusingRef) {
                    delete this.functionDefinitions[obj.functionDefinition.name]
                    delete this.functionDefRef[obj.functionDefinition.name]
                }
                if (info.functionDefinition) {
                    obj.functionDefinition.conflict = this.functionDefinitions[info.functionDefinition.name] !== undefined
                    obj.functionDefinition.confusingRef = false
                    for (let i = 0; i < info.functionDefinition.usingFunctionNames.length; i++) {
                        if (this.functionDefRef[info.functionDefinition.usingFunctionNames[i]] && this.functionDefRef[info.functionDefinition.usingFunctionNames[i]].includes(info.functionDefinition.name)) {
                            obj.functionDefinition.confusingRef = true
                            break
                        }
                    }
                    if (!obj.functionDefinition.conflict && !obj.functionDefinition.confusingRef) {
                        this.functionDefinitions[info.functionDefinition.name] = info.functionDefinition.latex
                        this.functionDefRef[info.functionDefinition.name] = info.functionDefinition.usingFunctionNames
                    }
                } else {
                    obj.functionDefinition.conflict = false
                    obj.functionDefinition.confusingRef = false
                }

                obj.type = info.type
                obj.valid = info.valid
                obj.extraVars = info.extraVars
                if (info.varDefinition) {
                    obj.varDefinition.name = info.varDefinition.name
                    obj.varDefinition.v = info.varDefinition.v
                    obj.varDefinition.handle.min = Math.min(obj.varDefinition.handle.min, info.varDefinition.v)
                    obj.varDefinition.handle.max = Math.max(obj.varDefinition.handle.max, info.varDefinition.v)
                } else {
                    obj.varDefinition.handle.onAutoSlide = false
                }
                if (info.functionDefinition) {
                    obj.functionDefinition.name = info.functionDefinition.name
                    obj.functionDefinition.latex = info.functionDefinition.latex
                    obj.functionDefinition.usingFunctionNames = info.functionDefinition.usingFunctionNames
                }

                if (obj.type === exprTypes.varDefinition || obj.type === exprTypes.functionDefinition || info.type === exprTypes.varDefinition || info.type === exprTypes.functionDefinition) {
                    this.redrawGraphs()
                }

                this.redrawGraph(obj)
                break
            }
        }
    }
    pushExpr(expr, color) {
        const obj = reactive({
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
            varDefinition: {
                name: null,
                v: 0,
                handleType: 'handle',
                handle: {
                    min: -10,
                    max: 10,
                    minInput: '-10',
                    maxInput: '10',
                    onAutoSlide: false,
                    slideDirection: 1,
                },
                conflict: false,
            },
            functionDefinition: {
                name: '',
                latex: '',
                usingFunctionNames: [],
                enableDrawing: false,
                conflict: false,
                confusingRef: false,
            },
        })
        const worker = new graphWorker()
        worker.onmessage = (e) => {
            this.onWorkerMessage(obj, e)
        }
        obj.worker = worker
        this.exprs.push(obj)
    }
    editExpr(index, latex) {
        this.exprs[index].worker.postMessage([messageType.setExpr, latex])
    }
    removeExpr(index) {
        this.exprs[index].worker.terminate()
        let gobalInfluence = false
        if (this.exprs[index].type === exprTypes.varDefinition && !this.exprs[index].varDefinition.conflict) {
            delete this.varDefinitions[this.exprs[index].varDefinition.name]
            gobalInfluence = true
        }
        if (this.exprs[index].type === exprTypes.functionDefinition && !this.exprs[index].functionDefinition.conflict && !this.exprs[index].functionDefinition.confusingRef) {
            delete this.functionDefinitions[this.exprs[index].functionDefinition.name]
            delete this.functionDefRef[this.exprs[index].functionDefinition.name]
            gobalInfluence = true
        }
        this.exprs.splice(index, 1)

        if (gobalInfluence) {
            this.redrawGraphs()
            for (const expr of this.exprs) {
                let setFuncNotConflict = false
                let setFuncNotConfusingRef = false
                // handle other exprs' variable and function conflict
                if (expr.type === exprTypes.varDefinition && expr.varDefinition.conflict && !this.varDefinitions[expr.varDefinition.name]) {
                    expr.varDefinition.conflict = false
                    this.varDefinitions[expr.varDefinition.name] = expr.varDefinition.v
                } else if (expr.type === exprTypes.functionDefinition) {
                    const unconflict = !this.functionDefinitions[expr.functionDefinition.name]
                    expr.functionDefinition.conflict = !unconflict
                    setFuncNotConflict = unconflict
                }
                // handle function confusing reference
                if (expr.type === exprTypes.functionDefinition) {
                    let confusing = false
                    for (const name of expr.functionDefinition.usingFunctionNames) {
                        if (this.functionDefRef[name] && this.functionDefRef[name].includes(expr.functionDefinition.name)) {
                            confusing = true
                            break
                        }
                    }
                    expr.functionDefinition.confusingRef = confusing
                    setFuncNotConfusingRef = !confusing
                }
                console.log(setFuncNotConflict, setFuncNotConfusingRef)
                // finally handle function
                if (expr.type === exprTypes.functionDefinition && setFuncNotConflict && setFuncNotConfusingRef) {
                    this.functionDefinitions[expr.functionDefinition.name] = expr.functionDefinition.latex
                    this.functionDefRef[expr.functionDefinition.name] = expr.functionDefinition.usingFunctionNames
                }
            }
        }
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
        if (expr.type === exprTypes.functionDefinition && !expr.functionDefinition.enableDrawing || expr.type === exprTypes.varDefinition) {
            expr.ctx.clearRect(0, 0, this.getRect().width, this.getRect().height)
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
        const granularity = 3 // pixel gap between 2 points to find roots

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
    isLightMode() {
        return window.matchMedia('(prefers-color-scheme: light)').matches
    }
}

const manager = reactive(new GraphManager())
export default manager

let timeSpot = Date.now()
function stepAutoSlide() {
    const deltaTime = Date.now() - timeSpot
    timeSpot = Date.now()
    for (const expr of manager.exprs) {
        if (expr.type === exprTypes.varDefinition && expr.varDefinition.handle.onAutoSlide) {
            const deltaValue = expr.varDefinition.handle.slideDirection * (expr.varDefinition.handle.max - expr.varDefinition.handle.min) * deltaTime * 0.0004
            expr.varDefinition.v = Math.round((expr.varDefinition.v + deltaValue) * 1e3) / 1e3
            if (expr.varDefinition.v < expr.varDefinition.handle.min || expr.varDefinition.v > expr.varDefinition.handle.max) {
                expr.varDefinition.v = Math.round((expr.varDefinition.v - 2 * deltaValue) * 1e3) / 1e3
                expr.varDefinition.handle.slideDirection *= -1
            }
            const latex = expr.field.latex()
            expr.field.latex(latex.slice(0, latex.indexOf('=') + 1) + expr.varDefinition.v)
        }
    }
    requestAnimationFrame(stepAutoSlide)
}
stepAutoSlide()

const media = window.matchMedia('(prefers-color-scheme: light)')
media.addEventListener('change', () => {
    manager.redrawAll()
})


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
