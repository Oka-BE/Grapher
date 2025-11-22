<script setup>
import { onMounted, ref, nextTick } from 'vue'
import manager from './manager'
import { Equation, Expression, Item, Variable } from '@/class/mathStructs'
import { Vector2 } from '@/class/class'

manager._redrawCoordinate = redrawCoordinate
manager._redrawGraph = redrawGraph
manager.getRect = () => {
    return container.value.getBoundingClientRect()
}
manager.getView = () => {
    const rect = container.value.getBoundingClientRect()
    return {
        lowx: -Opos.x / pxPerUnit * unit,
        highx: (rect.width - Opos.x) / pxPerUnit * unit,
        lowy: (Opos.y - rect.height) / pxPerUnit * unit,
        highy: Opos.y / pxPerUnit * unit,
        Opos, pxPerUnit, unit,
    }
}

const container = ref()
const cCanvas = ref()
const dpr = window.devicePixelRatio || 1
let cCtx
let Opos = new Vector2(0, 0)
// how much pxPerUnit px stands for
// default: 180px => 1value
const pxPerUnit = 180
let unit = 1
const zoomSpeed = 1.1

function resizeCanvas() {
    const rect = container.value.getBoundingClientRect()
    cCanvas.value.width = rect.width * dpr
    cCanvas.value.height = rect.height * dpr
    cCtx = cCanvas.value.getContext('2d')
    cCtx.scale(dpr, dpr)
    cCtx.clearRect(0, 0, rect.width, rect.height)
    for (let i = 0; i < manager.exprs.length; i++) {
        const expr = manager.exprs[i]
        expr.cvs.width = rect.width * dpr
        expr.cvs.height = rect.height * dpr
        expr.ctx = expr.cvs.getContext('2d')
        expr.ctx.scale(dpr, dpr)
    }
    manager.redrawAll()
}
const resizeObserver = new ResizeObserver(() => {
    resizeCanvas()
})

manager.onFreepanelInit(() => {
    const rect = container.value.getBoundingClientRect()
    Opos = new Vector2(rect.width / 2, rect.height / 2)
    resizeCanvas()
})
onMounted(() => {
    resizeObserver.observe(container.value)
})

let coordinateAFI = -1
function redrawCoordinate() {
    cCtx.clearRect(0, 0, container.value.clientWidth, container.value.clientHeight)
    const width = container.value.clientWidth
    const height = container.value.clientHeight
    cCtx.lineWidth = 1

    // grid
    // show 1 or 2 or 5 * 10^n / 5 for each step
    const n = Math.floor(Math.log10(unit))
    const x = unit / (10 ** n)
    const target = [1, 2, 5].sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0]
    const step = target * (10 ** n) / unit * pxPerUnit / 5
    for (let i = Math.ceil(-Opos.y / step); Opos.y + i * step < height; i++) {
        cCtx.beginPath()
        cCtx.moveTo(0, Opos.y + i * step)
        cCtx.lineTo(width, Opos.y + i * step)
        if (i % 5 === 0) cCtx.strokeStyle = '#505050'
        else cCtx.strokeStyle = '#383838'
        cCtx.stroke()
    }
    for (let i = Math.ceil(-Opos.x / step); Opos.x + i * step < width; i++) {
        cCtx.beginPath()
        cCtx.moveTo(Opos.x + i * step, 0)
        cCtx.lineTo(Opos.x + i * step, height)
        if (i % 5 === 0) cCtx.strokeStyle = '#505050'
        else cCtx.strokeStyle = '#383838'
        cCtx.stroke()
    }

    // number
    cCtx.font = '12px Arial'
    cCtx.fillStyle = '#aaa'
    cCtx.textBaseline = 'middle'
    cCtx.textAlign = 'right'
    for (let i = Math.ceil(-Opos.y / step); Opos.y + i * step < height; i++) {
        if (i === 0) continue
        if (i % 5 === 0) {
            const val = (-i * step * unit / pxPerUnit).toFixed(4).replace(/\.?0+$/, '')
            cCtx.fillText(val, Opos.x - 2, Opos.y + i * step)
        }
    }
    cCtx.textBaseline = 'bottom'
    cCtx.textAlign = 'center'
    for (let i = Math.ceil(-Opos.x / step); Opos.x + i * step < width; i++) {
        if (i === 0) continue
        if (i % 5 === 0) {
            const val = (i * step * unit / pxPerUnit).toFixed(4).replace(/\.?0+$/, '')
            cCtx.fillText(val, Opos.x + i * step, Opos.y)
        }
    }

    cCtx.beginPath()
    // x axis
    cCtx.moveTo(0, Opos.y)
    cCtx.lineTo(width, Opos.y)
    // y axis
    cCtx.moveTo(Opos.x, 0)
    cCtx.lineTo(Opos.x, height)
    // arrows
    cCtx.moveTo(width - 10, Opos.y - 5)
    cCtx.lineTo(width, Opos.y)
    cCtx.lineTo(width - 10, Opos.y + 5)
    cCtx.moveTo(Opos.x - 5, 10)
    cCtx.lineTo(Opos.x, 0)
    cCtx.lineTo(Opos.x + 5, 10)
    cCtx.strokeStyle = '#aaa'
    cCtx.stroke()

    coordinateAFI = -1
}

function setGraphCtx(i, expr, el) {
    if (expr.init || !el || !container.value) return
    const rect = container.value.getBoundingClientRect()
    el.width = rect.width * dpr
    el.height = rect.height * dpr
    const ctx = el.getContext('2d')
    ctx.scale(dpr, dpr)
    expr.cvs = el
    expr.ctx = ctx
    expr.init = true
}
function redrawGraph(expr, xpointData, ypointData) {
    const rect = container.value.getBoundingClientRect()
    const maxLinkDis = manager.drawInfo.pxGap() * 2 // max distance for 2 points to link
    const step = manager.drawInfo.step()

    // const lowx = (-Opos.x - step) / pxPerUnit * unit
    // const highx = (rect.width - Opos.x + step) / pxPerUnit * unit
    // const lowy = (Opos.y - rect.height - step) / pxPerUnit * unit
    // const highy = (Opos.y + step) / pxPerUnit * unit

    const ctx = expr.ctx
    ctx.clearRect(0, 0, rect.width, rect.height)
    // for (let i = 0; i < points.length - 1; i++) {
    //     for (let j = 0; j < points[i].length; j++) {
    //         // ctx.beginPath()
    //         // ctx.arc(points[i][j].p.x, points[i][j].p.y, points[i][j].forx ? 3 : 1, 0, Math.PI * 2)
    //         // ctx.fillStyle = points[i][j].forx ? '#a11' : '#1a1'
    //         // ctx.fill()
    //         for (let k = j + 1; k < points[i].length; k++) {
    //             if (points[i][k].p.distanceTo(points[i][j].p) <= maxLinkDis) {
    //                 ctx.moveTo(points[i][j].p.x, points[i][j].p.y)
    //                 ctx.lineTo(points[i][k].p.x, points[i][k].p.y)
    //             }
    //         }
    //         for (let k = 0; k < points[i + 1].length; k++) {
    //             if (points[i + 1][k].p.distanceTo(points[i][j].p) <= maxLinkDis) {
    //                 ctx.moveTo(points[i][j].p.x, points[i][j].p.y)
    //                 ctx.lineTo(points[i + 1][k].p.x, points[i + 1][k].p.y)
    //             }
    //         }
    //     }
    // }
    ctx.fillStyle = expr.color
    ctx.strokeStyle = expr.color
    const states = {
        readn: 0,
        readx: 1,
        ready: 2,
    }
    let state = states.readn
    let n, x, y, px, py
    // draw point for debug
    // for (let i = 0; i < xpointData.length; i++) {
    //     switch (state) {
    //         case states.readn: {
    //             n = xpointData[i]
    //             state = states.readx
    //             break
    //         }
    //         case states.readx: {
    //             x = xpointData[i]
    //             px = Opos.x + x / unit * pxPerUnit
    //             state = states.ready
    //             break
    //         }
    //         case states.ready: {
    //             n--
    //             y = xpointData[i]
    //             py = Opos.y - y / unit * pxPerUnit
    //             ctx.beginPath()
    //             ctx.arc(px, py, 3, 0, Math.PI * 2)
    //             // ctx.fillStyle = points[i][j].forx ? '#a11' : '#1a1'
    //             ctx.fill()
    //             if (n === 0) {
    //                 state = states.readn
    //             }
    //             break
    //         }
    //     }
    // }
    // for (let i = 0; i < ypointData.length; i++) {
    //     switch(state) {
    //         case states.readn: {
    //             n = ypointData[i]
    //             state = states.ready
    //             break
    //         }
    //         case states.ready: {
    //             y = ypointData[i]
    //             py = Opos.y - y / unit * pxPerUnit
    //             state = states.readx
    //             break
    //         }
    //         case states.readx: {
    //             n--
    //             const x = ypointData[i]
    //             px = Opos.x + x / unit * pxPerUnit
    //             ctx.beginPath()
    //             ctx.arc(px, py, 1, 0, Math.PI * 2)
    //             // ctx.fillStyle = points[i][j].forx ? '#a11' : '#1a1'
    //             ctx.fill()
    //             if (n === 0) {
    //                 state = states.readn
    //             }
    //             break
    //         }
    //     }
    // }
    // draw line for real effect
    let points = Array.from({ length: Math.ceil((rect.width + step * 4) / maxLinkDis) }, () => [])
    for (let i = 0; i < xpointData.length; i++) {
        switch (state) {
            case states.readn: {
                n = xpointData[i]
                state = states.readx
                break
            }
            case states.readx: {
                x = xpointData[i]
                px = Opos.x + x / unit * pxPerUnit
                state = states.ready
                break
            }
            case states.ready: {
                n--
                y = xpointData[i]
                py = Opos.y - y / unit * pxPerUnit
                if (px >= 0 && px <= rect.width && py >= 0 && py <= rect.height) {
                    points[Math.floor((px + step * 2) / maxLinkDis)].push(new Vector2(px, py))
                }
                if (n === 0) {
                    state = states.readn
                }
            }
        }
    }
    state = states.readn
    for (let i = 0; i < ypointData.length; i++) {
        switch (state) {
            case states.readn: {
                n = ypointData[i]
                state = states.ready
                break
            }
            case states.ready: {
                y = ypointData[i]
                py = Opos.y - y / unit * pxPerUnit
                state = states.readx
                break
            }
            case states.readx: {
                n--
                x = ypointData[i]
                px = Opos.x + x / unit * pxPerUnit
                if (px >= 0 && px <= rect.width && py >= 0 && py <= rect.height) {
                    points[Math.floor((px + step * 2) / maxLinkDis)].push(new Vector2(px, py))
                }
                if (n === 0) {
                    state = states.readn
                }
            }
        }
    }
    ctx.beginPath()
    for (let i = 0; i < points.length - 1; i++) {
        for (let j = 0; j < points[i].length; j++) {
            for (let k = j + 1; k < points[i].length; k++) {
                if (points[i][j].distanceTo(points[i][k]) <= maxLinkDis) {
                    ctx.moveTo(points[i][j].x, points[i][j].y)
                    ctx.lineTo(points[i][k].x, points[i][k].y)
                }
            }
            for (let k = 0; k < points[i + 1].length; k++) {
                if (points[i][j].distanceTo(points[i + 1][k]) <= maxLinkDis) {
                    ctx.moveTo(points[i][j].x, points[i][j].y)
                    ctx.lineTo(points[i + 1][k].x, points[i + 1][k].y)
                }
            }
        }
    }
    ctx.stroke()
}

function zoom(e) {
    e.preventDefault()
    const rect = container.value.getBoundingClientRect()
    const mousePos = new Vector2(e.clientX - rect.left, e.clientY - rect.top)
    const innerPos = mousePos.sub(Opos).mul(unit / pxPerUnit)
    const delta = e.deltaY > 0 ? zoomSpeed : 1 / zoomSpeed
    unit *= delta
    Opos = mousePos.sub(innerPos.mul(pxPerUnit / unit))
    manager.redrawAll()
}

function mousedown(e) {
    e.preventDefault()
    ondrag(e)
}
let odragPos = new Vector2(0, 0)
let oOpos = new Vector2(0, 0)
function ondrag(e) {
    odragPos = new Vector2(e.clientX, e.clientY)
    oOpos = Opos.clone()
    window.addEventListener('mousemove', dodrag)
    window.addEventListener('mouseup', donedrag)
}
function dodrag(e) {
    const newdragPos = new Vector2(e.clientX, e.clientY)
    Opos = oOpos.add(newdragPos.sub(odragPos))
    manager.redrawAll()
}
function donedrag() {
    window.removeEventListener('mousemove', dodrag)
    window.removeEventListener('mouseup', donedrag)
}
</script>

<template>
    <div ref="container" class="size-full overflow-hidden relative" @wheel="zoom">
        <canvas ref="cCanvas" class="absolute top-0 left-0 size-full" @mousedown="mousedown"></canvas>
        <canvas v-for="(expr, i) in manager.exprs" :key="expr.id" :ref="(el) => setGraphCtx(i, expr, el)"
            class="absolute top-0 left-0 size-full pointer-events-none"></canvas>
    </div>
</template>