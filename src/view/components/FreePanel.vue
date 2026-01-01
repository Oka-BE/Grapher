<script setup>
import { defineProps, onMounted, ref, defineEmits, nextTick } from 'vue';

const props = defineProps({
    vertical: {
        default: false
    },
    hideable1: {
        default: false
    },
    hideable2: {
        default: false
    },
    min1: {
        default: 100
    },
    min2: {
        default: 100
    },
    init: {
        default: "50",
    }
})
const emit = defineEmits(['init'])
const size = ref(0);
const handleWidth = 8
const container = ref()

let rate = null
function containerResize() {
    const rect = container.value.getBoundingClientRect()
    updateHandle(rate * (props.vertical ? rect.height : rect.width))
}
const resizeObserver = new ResizeObserver(containerResize)

onMounted(() => {
    const rect = container.value.getBoundingClientRect()
    size.value = typeof props.init === 'string' ?
        (props.vertical ?
            rect.height : rect.width) * Number(props.init) * 0.01 :
        props.init < 0 ?
            (props.vertical ?
                rect.height : rect.width) + props.init :
            props.init
    rate = (size.value / (props.vertical ? rect.height : rect.width))
    updateHandle(size.value)
    resizeObserver.observe(container.value)
    nextTick(() => {
        emit('init')
    })
})

const isdraggingHandle = ref(false)
const isoverHandle = ref(false)
const ishidden1 = ref(false)
const ishidden2 = ref(false)
function overHandle() {
    isoverHandle.value = true
    if (isdraggingHandle.value) return
    document.body.style.cursor = props.vertical ? 'n-resize' : 'e-resize'
    document.body.style.userSelect = 'none'
}
function outHandle() {
    isoverHandle.value = false
    if (isdraggingHandle.value) return
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
}
function downHandle() {
    window.addEventListener('mousemove', moveHandle)
    window.addEventListener('mouseup', upHandle)
    isdraggingHandle.value = true
}
function updateHandle(newSize) {
    const rect = container.value.getBoundingClientRect()
    if (props.vertical) {
        if (props.hideable1 && newSize < props.min1 / 2) {
            newSize = 0
            ishidden1.value = true
        }
        else if (newSize < props.min1) {
            newSize = props.min1
            ishidden1.value = false
        }
        if (props.hideable2 && rect.height - newSize < props.min2 / 2) {
            newSize = rect.height
            ishidden2.value = true
        }
        else if (rect.height - newSize < props.min2) {
            newSize = rect.height - props.min2
            ishidden2.value = false
        }
        size.value = newSize
    } else {
        if (props.hideable1 && newSize < props.min1 / 2) {
            newSize = 0
            ishidden1.value = true
        }
        else if (newSize < props.min1) {
            newSize = props.min1
            ishidden1.value = false
        }
        if (props.hideable2 && rect.width - newSize < props.min2 / 2) {
            newSize = rect.width
            ishidden2.value = true
        }
        else if (rect.width - newSize < props.min2) {
            newSize = rect.width - props.min2
            ishidden2.value = false
        }
        size.value = newSize
    }
    rate = size.value / (props.vertical ? rect.height : rect.width)
}
function moveHandle(e) {
    const rect = container.value.getBoundingClientRect()
    updateHandle(props.vertical ? e.clientY - rect.top : e.clientX - rect.left)
}
function upHandle() {
    window.removeEventListener('mousemove', moveHandle)
    window.removeEventListener('mouseup', upHandle)
    isdraggingHandle.value = false
    if (isoverHandle.value) return
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
}

</script>

<template>
    <div ref="container" class="relative size-full">
        <div class="size-full grid overflow-hidden" :style="{
            gridTemplateColumns: vertical ? '' : `${size}px 1fr`,
            gridTemplateRows: vertical ? `${size}px 1fr` : ''
        }">
            <div>
                <slot name="1"></slot>
            </div>
            <div>
                <slot name="2"></slot>
            </div>
        </div>
        <div @mouseover="overHandle" @mouseout="outHandle" @mousedown="downHandle"
            class="absolute"
            :style="{
                top: vertical ? `${size + handleWidth / 2 * (ishidden1 ? 0 : ishidden2 ? -2 : -1)}px` : '0',
                left: vertical ? '0' : `${size + handleWidth / 2 * (ishidden1 ? 0 : ishidden2 ? -2 : -1)}px`,
                width: vertical ? '100%' : `${handleWidth}px`,
                height: vertical ? `${handleWidth}px` : '100%',
            }">
            <div v-if="!vertical" class="w-1px h-full absolute left-[calc(50%-0.5px)] bg-[light-dark(#888,#444)] op-50"></div>
        </div>
    </div>
</template>