<script setup>
import { views } from './router';
import router from './router';
import Graph from './views/Graph/Graph.vue';

</script>

<template>
  <!-- <div class="w-100vw h-100vh absolute left-0 top-0 grid grid-cols-[160px_1fr] bg-#333437 overflow-hidden">
    <div class="bg-#292a2c flex flex-col">
      <router-link :to="'/' + item.id" v-for="item in views"
        class="color-#ddd bg-#292a2c transition-filter hover:cursor-pointer px-3 py-2 decoration-none select-none" :class="{ 'filter-brightness-120 hover:filter-brightness-110': router.currentRoute.value.fullPath.includes(item.id), 'hover:filter-brightness-90': !router.currentRoute.value.fullPath.includes(item.id) }" :key="item.id"
      >{{ item.id }}</router-link>
    </div>
    <div>
      <router-view></router-view>
    </div>
  </div> -->
  <div class="w-100vw h-100vh absolute left-0 top-0 bg-#333437 overflow-hidden">
    <Graph></Graph>
  </div>
</template>
