import { Equation } from "@/class/structs"
import { messageType } from "./shared"
import { Vector2 } from "@/class/vector"

let equ = null
let valid = true

onmessage = (e) => {
    switch (e.data[0]) {
        case messageType.test: {
            const buffer = e.data[1]
            const arr = Array.from(new Float64Array(buffer))
            console.log(arr)
            postMessage([messageType.test, buffer], [buffer])
            break
        }
        case messageType.setExpr: {
            valid = true
            let latex = e.data[1]
            const equalIndex = latex.indexOf('=')
            if (equalIndex === -1) {
                valid = latex.indexOf('y') === -1
                latex = 'y=' + latex
            }
            equ = Equation.parse(latex)
            if (equ) {
                equ.form()
            }
            break
        }
        case messageType.computeGraph: {
            if (equ === null || !valid) {
                postMessage([messageType.returnGraph, null])
                return
            }
            const vars = equ.allVars()
            if (vars.filter(v => v.name !== 'x' && v.name !== 'y').length > 0) {
                // console.log('skip', vars)
                postMessage([messageType.returnGraph, null])
                return
            }

            let [
                lowx, highx, lowy, highy,
                step, granularity, maxGap,
                iterationCount, iterationPadding,
            ] = e.data[1]
            lowx -= step
            highx += step
            lowy -= step
            highy += step

            /**
             * pointData结构：
             * [n, x, y1...yn, ...]
             */

            const pointData4x = []
            if (vars.find(v => v.name === 'y')) {
                const points4x = []
                for (let x = lowx; x <= highx; x += step) {
                    equ.hiddenSubstitute({ x })
                    const roots = equ.findRoots(lowy, highy, granularity, maxGap)
                    points4x.push(roots.map(r => new Vector2(x, r)))
                }
                // 迭代细化
                for (let i = 0; i < points4x.length - 1; i++) {
                    const currPoints = points4x[i]
                    const nextPoints = points4x[i + 1]
                    if (currPoints.length) {
                        pointData4x.push(currPoints.length)
                        pointData4x.push(currPoints[0].x)
                        for (let j = 0; j < currPoints.length; j++) {
                            pointData4x.push(currPoints[j].y)
                        }
                    }

                    let allrangeMode = false
                    let min, max
                    if (currPoints.length === 0 || nextPoints.length === 0) {
                        allrangeMode = true
                    } else {
                        min = Math.min(
                            currPoints.reduce((acc, c) => Math.min(acc, c.y), currPoints[0].y),
                            nextPoints.reduce((acc, c) => Math.min(acc, c.y), nextPoints[0].y)
                        )
                        max = Math.max(
                            currPoints.reduce((acc, c) => Math.max(acc, c.y), currPoints[0].y),
                            nextPoints.reduce((acc, c) => Math.max(acc, c.y), nextPoints[0].y)
                        )
                    }
                    for (let j = 0; j < iterationCount; j++) {
                        const x = lowx + i * step + step * (j + 1) / (iterationCount + 1)
                        equ.hiddenSubstitute({ x })
                        let roots
                        if (allrangeMode) {
                            roots = equ.findRoots(lowy, highy, granularity, maxGap)
                        } else {
                            roots = equ.findRoots(min - iterationPadding, max + iterationPadding, granularity, maxGap)
                            // if no root, search in rest range
                            if (roots.length === 0) {
                                roots = [...equ.findRoots(max - iterationPadding, highy, granularity, maxGap), ...equ.findRoots(lowy, min + iterationPadding, granularity, maxGap)]
                            }
                        }
                        if (roots.length) {
                            pointData4x.push(roots.length)
                            pointData4x.push(x)
                            for (let k = 0; k < roots.length; k++) {
                                pointData4x.push(roots[k])
                            }
                        }
                    }
                }
                if (points4x.length > 0) {
                    const currPoints = points4x[points4x.length - 1]
                    if (currPoints.length) {
                        pointData4x.push(currPoints.length)
                        pointData4x.push(currPoints[0].x)
                        for (let j = 0; j < currPoints.length; j++) {
                            pointData4x.push(currPoints[j].y)
                        }
                    }
                }
                equ.hiddenSubstitute({ x: null })
            }
            const xbuffer = new Float64Array(pointData4x).buffer

            const pointData4y = []
            if (vars.find(v => v.name === 'x')) {
                const points4y = []
                for (let y = lowy; y <= highy; y += step) {
                    equ.hiddenSubstitute({ y })
                    const roots = equ.findRoots(lowx, highx, granularity, maxGap)
                    points4y.push(roots.map(r => new Vector2(r, y)))
                }
                // 迭代细化
                for (let i = 0; i < points4y.length - 1; i++) {
                    const currPoints = points4y[i]
                    const nextPoints = points4y[i + 1]
                    if (currPoints.length) {
                        pointData4y.push(currPoints.length)
                        pointData4y.push(currPoints[0].y)
                        for (let j = 0; j < currPoints.length; j++) {
                            pointData4y.push(currPoints[j].x)
                        }
                    }

                    let allrangeMode = false
                    let min, max
                    if (currPoints.length === 0 || nextPoints.length === 0) {
                        allrangeMode = true
                    } else {
                        min = Math.min(
                            currPoints.reduce((acc, c) => Math.min(acc, c.x), currPoints[0].x),
                            nextPoints.reduce((acc, c) => Math.min(acc, c.x), nextPoints[0].x)
                        )
                        max = Math.max(
                            currPoints.reduce((acc, c) => Math.max(acc, c.x), currPoints[0].x),
                            nextPoints.reduce((acc, c) => Math.max(acc, c.x), nextPoints[0].x)
                        )
                    }
                    for (let j = 0; j < iterationCount; j++) {
                        const y = lowy + i * step + step * (j + 1) / (iterationCount + 1)
                        equ.hiddenSubstitute({ y })
                        let roots
                        if (allrangeMode) {
                            roots = equ.findRoots(lowx, highx, granularity, maxGap)
                        } else {
                            roots = equ.findRoots(min - iterationPadding, max + iterationPadding, granularity, maxGap)
                            // if no root, search in rest range
                            if (roots.length === 0) {
                                roots = [...equ.findRoots(max - iterationPadding, highx, granularity, maxGap), ...equ.findRoots(lowx, min + iterationPadding, granularity, maxGap)]
                            }
                        }
                        if (roots.length) {
                            pointData4y.push(roots.length)
                            pointData4y.push(y)
                            for (let k = 0; k < roots.length; k++) {
                                pointData4y.push(roots[k])
                            }
                        }
                    }
                }
                if (points4y.length > 0) {
                    const currPoints = points4y[points4y.length - 1]
                    if (currPoints.length) {
                        pointData4y.push(currPoints.length)
                        pointData4y.push(currPoints[0].y)
                        for (let j = 0; j < currPoints.length; j++) {
                            pointData4y.push(currPoints[j].x)
                        }
                    }
                }
                equ.hiddenSubstitute({ y: null })
            }
            const ybuffer = new Float64Array(pointData4y).buffer

            postMessage([messageType.returnGraph, xbuffer, ybuffer], [xbuffer, ybuffer])
            break
        }
    }
}