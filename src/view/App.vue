<script setup>
import { views } from './router';
import router from './router';
import Graph from './views/Graph/Graph.vue';

</script>

<template>
  <div class="w-100vw h-100vh absolute left-0 top-0 bg-[light-dark(#eee,#333437)] overflow-hidden">
    <!-- <video src="/background/柠檬_1_1.mp4" muted loop autoplay class="absolute left-0 top-0 op-5 object-cover size-full"></video> -->
    <Graph></Graph>
  </div>
</template>
