<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue'
import { Equation, Expression, parseExpression } from '@/class/structs'
import manager from './manager'

const func = ref(null)
const funcs = reactive([])
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
onMounted(() => {
})

function pushFunc(focus = true) {
    const color = colorSets[(usingColor = (usingColor + 1) % colorSets.length)]
    funcs.push({
        id: Symbol(),
        field: null,
        color,
        valid: true
    })
    manager.pushExpr(null, color)
    nextTick(() => {
        const obj = funcs[funcs.length - 1]
        funcs[funcs.length - 1].field = MQ.MathField(func.value[funcs.length - 1], {
            spaceBehavesLikeTab: true,
            handlers: {
                edit: function () {
                    const i = funcs.indexOf(obj)
                    if (i === -1) return
                    const latex = obj.field.latex()
                    manager.editExpr(i, latex)
                    console.log(latex)
                },
                enter: function () {
                    if (funcs.indexOf(obj) === funcs.length - 1) pushFunc()
                    else funcs[funcs.indexOf(obj) + 1].field.focus()
                },
                deleteOutOf: function () {
                    if (funcs.length > 1) {
                        const idx = funcs.indexOf(obj)
                        removefunc(idx)
                        if (idx < funcs.length) funcs[idx].field.focus()
                        else funcs[idx - 1].field.focus()
                    }
                },
                upOutOf: function () {
                    if (funcs.indexOf(obj) > 0) funcs[funcs.indexOf(obj) - 1].field.focus()
                },
                downOutOf: function () {
                    if (funcs.indexOf(obj) < funcs.length - 1) funcs[funcs.indexOf(obj) + 1].field.focus()
                }
            }
        })
        if (focus) obj.field.focus()
    })
}
function removefunc(i) {
    funcs.splice(i, 1)
    manager.removeExpr(i)
}

</script>

<template>
    <div class="size-full flex flex-col gap-10 color-#eee overflow-hidden">
        <div class="px-6">
            <h2 class="mt-3 mb-2 select-none">键入表达式</h2>
            <div class="flex flex-col gap-2">
                <div v-for="(f, i) in funcs" :key="f.id" class="bg-#3a3a3c rounded-4px overflow-hidden grid" :class="{
                    'outline-solid outline-red outline-1px': !f.valid,
                    'grid-cols-[4px_1fr_1em]': funcs.length > 1,
                    'grid-cols-[4px_1fr]': funcs.length === 1,
                }">
                    <div :style="{ backgroundColor: f.color }"></div>
                    <span ref="func" class="px-1 py-0.5 font-size-1.1em"></span>
                    <button @click="removefunc(i)" v-if="funcs.length > 1"
                        class="bg-#3a3a3c color-#666 flex justify-center items-center shadow-transparent border-none hover-filter-brightness-120 hover-cursor-pointer">×</button>
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