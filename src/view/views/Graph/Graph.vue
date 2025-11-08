<script setup>
import FreePanel from '../../components/FreePanel.vue'
import Draw from './Draw.vue'
import Function from './Function.vue'
import manager from './manager'

</script>

<template>
    <FreePanel :hideable1="true" :min1="200" :min2="300" :init="300" @init="manager.freepanelInit()">
        <template #1>
            <Function></Function>
        </template>
        <template #2>
            <Draw></Draw>
        </template>
    </FreePanel>
</template>