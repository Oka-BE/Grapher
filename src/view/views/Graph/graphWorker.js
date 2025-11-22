import { Equation, FunctionDefinition, VariableDefinition } from "@/class/mathStructs"
import { messageType, exprTypes } from "./shared"
import { Vector2 } from "@/class/class"

let originEqu = null
let equ = null
let functions = {}
let fresh = true

onmessage = (e) => {
    switch (e.data[0]) {
        case messageType.setExpr: {
            let latex = e.data[1]
            const equalIndex = latex.indexOf('=')
            const info = {
                type: null,
                valid: false,
                extraVars: [],
                varDefinition: null,
                functionDefinition: null,
            }
            if (equalIndex === -1) {
                if (latex.indexOf('y') !== -1) {
                    equ = null
                } else {
                    equ = Equation.parse('y=' + latex)
                    // console.log(JSON.stringify(equ, null, 2))
                    if (equ !== null) {
                        info.type = exprTypes.expression
                        info.valid = true
                        info.extraVars = equ.allVars().map(v => v.name).filter(name => name !== 'x' && name !== 'y')
                        equ.form()
                    }
                }
            } else {
                const vd = VariableDefinition.parse(latex)
                const fd = FunctionDefinition.parse(latex)
                const eq = Equation.parse(latex)
                if (vd !== null) {
                    equ = null
                    info.type = exprTypes.varDefinition
                    info.valid = true
                    info.varDefinition = {
                        name: vd.name,
                        v: vd.v,
                    }
                } else if (fd !== null) {
                    // console.log(JSON.stringify(fd, null, 2))
                    equ = null
                    info.type = exprTypes.functionDefinition
                    info.valid = true
                    info.extraVars = fd.extraVars
                    info.functionDefinition = {
                        name: fd.name,
                        latex,
                        usingFunctionNames: fd.expr.allFunctions(),
                    }
                } else if (eq !== null) {
                    equ = eq
                    info.type = exprTypes.equation
                    info.valid = true
                    info.extraVars = equ.allVars().map(v => v.name).filter(name => name !== 'x' && name !== 'y')
                    equ.form()
                }
            }
            if (equ !== null) {
                originEqu = equ.clone()
            }
            fresh = true
            postMessage([messageType.shareInfo, info])
            break
        }
        case messageType.computeGraph: {
            if (equ === null) {
                postMessage([messageType.returnGraph, null])
                return
            }

            let [
                lowx, highx, lowy, highy,
                step, granularity, maxGap,
                iterationCount, iterationPadding,
                varDefinitions, functionDefinitions
            ] = e.data[1]
            lowx -= step
            highx += step
            lowy -= step
            highy += step
            // console.log((highx - lowx) / granularity)

            for (const [name, v] of varDefinitions) {
                equ.hiddenSubstitute({ [name]: v })
            }
            const vars = equ.allVars()
            if (vars.filter(v => v.name !== 'x' && v.name !== 'y' && v.v === null).length > 0) {
                postMessage([messageType.returnGraph, null])
                return
            }

            const entries = Object.entries(functions)
            const functionUnchanged = entries.reduce((acc, c) => {
                return acc && functionDefinitions.find(d => d[1] === c[1].latex)
            }, true) && entries.length === functionDefinitions.length
            if (!functionUnchanged) {
                equ = originEqu
                const newFunctions = {}
                for (const [name, fdlatex] of functionDefinitions) {
                    newFunctions[name] = {
                        latex: fdlatex,
                        definition:
                            functions[name] && functions[name].latex === fdlatex ?
                                functions[name].definition : FunctionDefinition.parse(fdlatex),
                    }
                }
                functions = newFunctions
                originEqu = equ.clone()
                equ.replaceFunction(Object.entries(functions).map(f => f[1].definition))
                console.log(equ.latex())
            }
            if (fresh) {
                fresh = false
                equ.replaceFunction(Object.entries(functions).map(f => f[1].definition))
                // console.log(equ.latex())
            }
            // if (!equ.linkComplete()) {
            if (equ.allFunctions().length > 0) {
                postMessage([messageType.returnGraph, null])
                return
            }

            /**
             * pointData结构：
             * [n, x, y1...yn, ...]
             */

            console.time()
            const pointData4x = []
            if (vars.find(v => v.name === 'y')) {
                const points4x = []
                for (let x = lowx; x <= highx; x += step) {
                    equ.hiddenSubstitute({ x })
                    const roots = equ.findRoots(lowy, highy, granularity, maxGap)
                    let min = Infinity, max = -Infinity
                    for (let i = 0; i < roots.length; i++) {
                        min = Math.min(min, roots[i])
                        max = Math.max(max, roots[i])
                    }
                    points4x.push({
                        x, roots, min, max
                    })
                }
                // 迭代细化
                for (let i = 0; i < points4x.length - 1; i++) {
                    const currPoints = points4x[i]
                    const nextPoints = points4x[i + 1]
                    if (currPoints.roots.length) {
                        pointData4x.push(currPoints.roots.length)
                        pointData4x.push(currPoints.x)
                        for (let j = 0; j < currPoints.roots.length; j++) {
                            pointData4x.push(currPoints.roots[j])
                        }
                    }

                    let allrangeMode = false
                    let min = Math.min(currPoints.min, nextPoints.min), max = Math.max(currPoints.max, nextPoints.max)
                    if (currPoints.roots.length === 0 || nextPoints.roots.length === 0) {
                        allrangeMode = true
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
                    if (currPoints.roots.length) {
                        pointData4x.push(currPoints.roots.length)
                        pointData4x.push(currPoints.x)
                        for (let j = 0; j < currPoints.roots.length; j++) {
                            pointData4x.push(currPoints.roots[j])
                        }
                    }
                }
                equ.hiddenSubstitute({ x: null })
            }
            const xbuffer = new Float32Array(pointData4x).buffer

            const pointData4y = []
            if (vars.find(v => v.name === 'x')) {
                const points4y = []
                for (let y = lowy; y <= highy; y += step) {
                    equ.hiddenSubstitute({ y })
                    const roots = equ.findRoots(lowx, highx, granularity, maxGap)
                    let min = Infinity, max = -Infinity
                    for (let i = 0; i < roots.length; i++) {
                        min = Math.min(min, roots[i])
                        max = Math.max(max, roots[i])
                    }
                    points4y.push({ y, roots, min, max })
                }
                // 迭代细化（对称第一段）
                for (let i = 0; i < points4y.length - 1; i++) {
                    const currPoints = points4y[i]
                    const nextPoints = points4y[i + 1]
                    if (currPoints.roots.length) {
                        pointData4y.push(currPoints.roots.length)
                        pointData4y.push(currPoints.y)
                        for (let j = 0; j < currPoints.roots.length; j++) {
                            pointData4y.push(currPoints.roots[j])
                        }
                    }

                    let allrangeMode = false
                    let min = Math.min(currPoints.min, nextPoints.min), max = Math.max(currPoints.max, nextPoints.max)
                    if (currPoints.roots.length === 0 || nextPoints.roots.length === 0) {
                        allrangeMode = true
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
                    if (currPoints.roots.length) {
                        pointData4y.push(currPoints.roots.length)
                        pointData4y.push(currPoints.y)
                        for (let j = 0; j < currPoints.roots.length; j++) {
                            pointData4y.push(currPoints.roots[j])
                        }
                    }
                }
                equ.hiddenSubstitute({ y: null })
            }
            const ybuffer = new Float32Array(pointData4y).buffer

            console.timeEnd()
            postMessage([messageType.returnGraph, xbuffer, ybuffer], [xbuffer, ybuffer])
            for (const [name, v] of varDefinitions) {
                equ.hiddenSubstitute({ [name]: null })
            }

            break
        }
    }
}