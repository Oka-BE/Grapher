import { reactive } from 'vue'
import { Expression, Equation, FlatComputation } from '../../../class/structs.js'
import graphWorker from './graphWorker.js?worker'
import { messageType } from './shared.js'

class GraphManager {
    exprs = []
    _redrawCoordinate
    coordinateAFI = null
    _redrawGraph
    graphAFI = null
    waitingFinalGraphRedraw = false
    freepanelInitCallbacks = []
    getRect
    getView
    drawInfo = {
        step: () => {
            const rect = this.getRect()
            return (rect.width + rect.height) / 2 / 10
        }
    }
    pushExpr(expr, color) {
        const obj = {
            init: false,
            expr,
            color,
            id: Symbol(),
            cvs: null,
            ctx: null,
            worker: null,
            workerLocked: false,
            workerExtra: false,
        }
        const worker = new graphWorker()
        worker.onmessage = (e) => {
            if (e.data[0] === messageType.returnGraph) {
                if (e.data[1] === null) {
                    const rect = this.getRect()
                    obj.ctx.clearRect(0, 0, rect.width, rect.height)
                } else {
                    const [xbuffer, ybuffer] = [e.data[1], e.data[2]]
                    const xpointData = Array.from(new Float64Array(xbuffer))
                    const ypointData = Array.from(new Float64Array(ybuffer))
                    this._redrawGraph(obj, xpointData, ypointData)
                }
            }
            obj.workerLocked = false
            if (obj.workerExtra) {
                obj.workerExtra = false
                this.redrawGraph(obj)
            }
        }
        obj.worker = worker
        this.exprs.push(obj)
    }
    editExpr(index, latex) {
        // this.exprs[index].expr = expr
        this.exprs[index].worker.postMessage([messageType.setExpr, latex])
        this.redrawGraph(this.exprs[index])
    }
    removeExpr(index) {
        // const rect = this.getRect()
        // this.exprs[index].ctx.clearRect(0, 0, rect.width, rect.height)
        this.exprs[index].worker.terminate()
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
        if (expr.workerLocked) {
            expr.workerExtra = true
            return
        }
        
        const view = this.getView()
        const rect = this.getRect()

        const step = this.drawInfo.step() // pixel gap between computed points
        const iterationCount = Math.floor(step / 6) // times of iterations to refine points
        const iterationPadding = 20
        const granularity = 3 // pixel gap between 2 points to find roots

        const innerStep = step / view.pxPerUnit * view.unit
        const innerGranularity = view.unit / view.pxPerUnit * granularity
        const innerMaxGap = view.unit / view.pxPerUnit * 0.05
        const innerIterationPadding = iterationPadding / view.pxPerUnit * view.unit

        expr.workerLocked = true
        expr.worker.postMessage([messageType.computeGraph, [
            view.lowx, view.highx, view.lowy, view.highy,
            innerStep, innerGranularity, innerMaxGap,
            iterationCount, innerIterationPadding,
        ]])
    }
    redrawGraphs(startIndex = 0, force = false) {
        // if (this.waitingFinalGraphRedraw && !force) return
        // if (this.graphAFI === null || force) {
        //     this.graphAFI = requestAnimationFrame(() => {
        //         const startTime = performance.now()
        //         for (let i = startIndex; i < this.exprs.length; i++) {
        //             if (performance.now() - startTime > 8) {
        //                 this.graphAFI = requestAnimationFrame(this.redrawGraphs.bind(this, i, true))
        //                 return
        //             }
        //             this._redrawGraph(i)
        //         }
        //         this.graphAFI = null
        //         if (this.waitingFinalGraphRedraw) {
        //             this.waitingFinalGraphRedraw = false
        //             this.redrawGraphs()
        //         }
        //     })
        // } else {
        //     this.waitingFinalGraphRedraw = true
        // }
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


const equ = new Equation('x^2+3x-1=3')
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
// console.log(equ.latex())
