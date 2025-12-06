<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
    size: {
        default: 1,
    },
    width: {
        default: 2.2
    },
    height: {
        default: 1.2
    },
    backgroundColor: {
        default: '#424242'
    },
    handleOffColor: {
        default: '#242424'
    },
    handleOnColor: {
        default: '#0088d6'
    },
    transitionDuration: {
        default: 200,
    },
    gapRate: {
        default: 0.12
    }
})

const width = computed(() => props.width * props.size)
const height = computed(() => props.height * props.size)

const isOn = defineModel()
const emit = defineEmits(['toggle'])

function toggle() {
    isOn.value = !isOn.value
    emit('toggle')
}

</script>

<template>
    <div class="rounded-full flex items-center justify-center cursor-pointer" :style="{
        backgroundColor: backgroundColor,
        width: `${width}rem`,
        height: `${height}rem`
    }" @click="toggle">
        <div class="h-0" :style="{ width: `${width - height * gapRate * 2}rem` }">
            <div class="rounded-full transform-translate-[0,-50%] transition-[transform,background-color]" :style="{
                backgroundColor: isOn ? handleOnColor : handleOffColor,
                width: `${height - height * gapRate * 2}rem`,
                height: `${height - height * gapRate * 2}rem`,
                transform: isOn ? `translate(${width - height * gapRate * 2 - (height - height * gapRate * 2)}rem, -50%)` : 'translate(0, -50%)',
                transitionDuration: `${transitionDuration}ms`,
            }"></div>
        </div>
    </div>
</template>