<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue'
import manager from './manager'
import { exprTypes } from './shared'
import { Vector2 } from '@/class/class'
import Switch from '@/view/components/Switch.vue'
import SlidableInput from '@/view/components/SlidableInput.vue'

const MQ = MathQuill.getInterface(2)

const field = ref()
const colorSets = [
    '#1f77b4', // 深蓝色
    '#aec7e8', // 灰蓝色
    '#ff7f0e', // 深橙色
    '#ffbb78', // 浅橙色
    '#2ca02c', // 深绿色
    '#98df8a', // 浅绿色
    '#d62728', // 深红色
    '#ff9896', // 浅红色
    '#9467bd', // 深紫色
    '#c5b0d5', // 浅紫色
    '#8c564b', // 深棕色
    '#c49c94', // 浅棕色
    '#e377c2', // 深粉色
    '#f7b6d2', // 浅粉色
    '#7f7f7f', // 深灰色
    '#c7c7c7'  // 浅灰色
]
let usingColor = -1

pushFunc()

function pushFunc(focus = true) {
    const color = colorSets[(usingColor = (usingColor + 1) % colorSets.length)]
    manager.pushExpr(null, color)
    nextTick(() => {
        const obj = manager.exprs[manager.exprs.length - 1]
        obj.field = MQ.MathField(field.value[manager.exprs.length - 1], {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: function () {
                    const i = manager.exprs.indexOf(obj)
                    // if (i === -1) return
                    const latex = obj.field.latex()
                    manager.editExpr(i, latex)
                    // if (obj.type !== exprTypes.varDefinition) {
                    //     console.log(latex)
                    // }
                    // console.log(JSON.stringify(Expression.parse(latex), null, 2))
                },
                enter: function () {
                    if (manager.exprs.indexOf(obj) === manager.exprs.length - 1) pushFunc()
                    else manager.exprs[manager.exprs.indexOf(obj) + 1].field.focus()
                },
                deleteOutOf: function () {
                    if (manager.exprs.length > 1) {
                        const idx = manager.exprs.indexOf(obj)
                        removefunc(idx)
                        if (idx < manager.exprs.length) manager.exprs[idx].field.focus()
                        else manager.exprs[idx - 1].field.focus()
                    }
                },
                upOutOf: function () {
                    if (manager.exprs.indexOf(obj) > 0) manager.exprs[manager.exprs.indexOf(obj) - 1].field.focus()
                },
                downOutOf: function () {
                    if (manager.exprs.indexOf(obj) < manager.exprs.length - 1) manager.exprs[manager.exprs.indexOf(obj) + 1].field.focus()
                }
            }
        })
        if (focus) obj.field.focus()
    })
}
function removefunc(i) {
    manager.removeExpr(i)
}

let deltaPos
let rect
let min, max
let expr
const handleTrack = ref(null)
function onHandle(_expr, i, e) {
    expr = _expr
    expr.varDefinition.handle.onAutoSlide = false
    rect = handleTrack.value[0].getBoundingClientRect()
    min = expr.varDefinition.handle.min
    max = expr.varDefinition.handle.max
    const v = expr.varDefinition.v
    deltaPos = (rect.left + (v - min) / (max - min) * (rect.right - rect.left)) - e.clientX
    window.addEventListener('mousemove', onDragHandle)
    window.addEventListener('mouseup', onFinishHandle)
    document.documentElement.classList.add('no-cursor-change')
}
function onDragHandle(e) {
    const currPos = e.clientX + deltaPos
    const rate = Math.min(Math.max((currPos - rect.left) / (rect.right - rect.left), 0), 1)
    const v = Math.round((min + (max - min) * rate) * 1e3) / 1e3
    const latex = expr.field.latex()
    expr.field.latex(latex.slice(0, latex.indexOf('=') + 1) + v)
}
function onFinishHandle() {
    window.removeEventListener('mousemove', onDragHandle)
    window.removeEventListener('mouseup', onFinishHandle)
    document.documentElement.classList.remove('no-cursor-change')
}

function editRange(expr, which) {
    const str = expr.varDefinition.handle[which + 'Input']
    const num = parseFloat(str)
    if (num !== expr.varDefinition.handle[which]) {
        expr.varDefinition.handle.onAutoSlide = false
    }
    if (!Number.isNaN(num) && typeof num === 'number' && Number.isFinite(num) && (which === 'min' ? num < expr.varDefinition.handle.max : expr.varDefinition.handle.min < num)) {
        expr.varDefinition.handle[which] = num
    }
    expr.varDefinition.handle[which + 'Input'] = expr.varDefinition.handle[which].toString()
    const v = Math.min(Math.max(expr.varDefinition.v, expr.varDefinition.handle.min), expr.varDefinition.handle.max)
    const latex = expr.field.latex()
    expr.field.latex(latex.slice(0, latex.indexOf('=') + 1) + v)
}
function keydownRange(e) {
    // enter失焦
    if (e.keyCode === 13) {
        e.target.blur()
    }
}
function mousedownCover(expr) {
    expr.varDefinition.handle.onAutoSlide = false
    setTimeout(() => {
        expr.field.focus()
    }, 10)
}
</script>

<template>
    <div class="size-full flex flex-col gap-10 color-#eee overflow-hidden">
        <div class="px-6">
            <h2 class="mt-3 mb-4 select-none">Expression Field</h2>
            <div class="flex flex-col gap-3">
                <div v-for="(expr, i) in manager.exprs" :key="expr.id" class="bg-#38383a rounded-4px overflow-hidden">
                    <div class="bg-#3a3a3c grid rounded-4px overflow-hidden shadow-xl relative" :class="{
                        'grid-cols-[4px_1fr_1em]': manager.exprs.length > 1,
                        'grid-cols-[4px_1fr]': manager.exprs.length === 1,
                    }">
                        <div v-if="expr.type === exprTypes.varDefinition && expr.varDefinition.handle.onAutoSlide"
                            class="cursor-text absolute top-0 left-4px right-1em h-full" :class="{
                                'w-[calc(100%-4px-1em)]': manager.exprs.length > 1,
                                'w-[calc(100%-4px)]': manager.exprs.length === 1,
                            }" @mousedown="mousedownCover(expr)"></div>
                        <div :style="{ backgroundColor: expr.color }"></div>
                        <span ref="field" class="px-1.2 py-0.7 font-size-1.2em"></span>
                        <button @click="removefunc(i)" v-if="manager.exprs.length > 1"
                            class="bg-#3a3a3c color-#666 flex justify-center items-center shadow-transparent border-none hover-filter-brightness-120 hover-cursor-pointer">×</button>
                    </div>
                    <div v-if="expr.type === exprTypes.varDefinition" class="p-2 select-none">
                        <div v-if="!expr.varDefinition.conflict">
                            <div class="h-7 grid grid-cols-[3em_1fr_3em]">
                                <input @focusout="editRange(expr, 'min')" v-model="expr.varDefinition.handle.minInput"
                                    @keydown="keydownRange($event)"
                                    class="outline-none bg-transparent border-none text-center"></input>
                                <div class="flex items-center justify-center">
                                    <div ref="handleTrack" class="w-full h-0 relative">
                                        <div class="bg-#444 w-full h-1 rounded-full transform-translate-[0,-50%]">
                                        </div>
                                        <div class="size-3 bg-blue rounded-full absolute top-0 transform-translate-[-50%,-50%] hover-bg-lightblue hover:transform-scale-120 transition-[transform,background-color]"
                                            :style="{ left: `${(expr.varDefinition.v - expr.varDefinition.handle.min) / (expr.varDefinition.handle.max - expr.varDefinition.handle.min) * 100}%` }"
                                            @mousedown="onHandle(expr, i, $event)"></div>
                                    </div>
                                </div>
                                <input @focusout="editRange(expr, 'max')" v-model="expr.varDefinition.handle.maxInput"
                                    @keydown="keydownRange($event)"
                                    class="outline-none bg-transparent border-none text-center"></input>
                            </div>
                            <div class="px-2 pt-2">
                                <div class="flex justify-between">
                                    <div class="font-size-0.8em">Auto Slide</div>
                                    <Switch v-model="expr.varDefinition.handle.onAutoSlide"></Switch>
                                </div>
                            </div>
                        </div>
                        <div v-else class="px-0.6em flex items-center gap-3 *:color-amber">
                            <span class="material-icons !font-size-8">warning</span>
                            <div class="font-size-4">Variable name conflict</div>
                        </div>
                    </div>
                    <div v-if="expr.type === exprTypes.functionDefinition" class="p-2 select-none">
                        <div v-if="!expr.functionDefinition.conflict && !expr.functionDefinition.confusingRef">
                            <div class="flex justify-between">
                                <div class="font-size-0.8em">EnableDrawing</div>
                                <Switch v-model="expr.functionDefinition.enableDrawing"
                                    @toggle="manager.redrawGraph(expr)"></Switch>
                            </div>
                        </div>
                        <div v-else-if="expr.functionDefinition.conflict"
                            class="px-0.6em flex items-center gap-3 *:color-amber">
                            <span class="material-icons !font-size-8">warning</span>
                            <div class="font-size-4">Function name conflict</div>
                        </div>
                        <div v-else-if="expr.functionDefinition.confusingRef"
                            class="px-0.6em flex items-center gap-3 *:color-amber">
                            <span class="material-icons !font-size-8">warning</span>
                            <div class="font-size-4">Function reference confuse</div>
                        </div>
                    </div>
                </div>
                <div class="mt-0.6em bg-#353537 border-solid border-1px border-#404040 shadow w-full h-8 rounded flex justify-center color-#666 line-height-7 cursor-pointer hover:brightness-106 hover:color-#aaa transition-[filter,color] select-none font-size-0.9em"
                    @click="pushFunc()">
                    create new...
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.mq-editable-field {
    border-color: transparent !important;
}

.mq-editable-field.mq-math-mode.mq-focused {
    border-color: transparent !important;
    box-shadow: none !important;
}
</style>