<script setup>

const value = defineModel()
const props = defineProps({
    handleWidth: {
        default: 1.6,
    },
    handleHeight: {
        default: 1,
    },
    gap: {
        default: 0.2,
    },
    inputWidth: {
        default: 1.8,   
    },
    inputHeight: {
        default: 1.5,
    },
    min: {
        default: -10,
    },
    max: {
        default: 10,
    },
    toFixed: {
        default: 1,
    },
    handleColor: {},
})

</script>

<template>
    <div :style="{
        width: `${handleWidth + gap + inputWidth}rem`,
        height: `${Math.max(handleHeight, inputHeight)}rem`,
        gridTemplateColumns: `${handleWidth}rem ${gap}rem ${inputWidth}rem`,
    }" class="grid">
        <div class="bg-blue flex justify-center items-center">
            <div class="rounded-full bg-#eee" :style="{
                width: `${handleWidth}rem`,
                height: `${handleHeight}rem`,
            }"></div>
        </div>
        <div class="bg-green"></div>
        <div class="bg-red">
            <input class="size-full outline-none border-none bg-transparent"></input>
        </div>
    </div>
</template>