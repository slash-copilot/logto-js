<script setup lang="ts">
import { useHandleSignInCallback } from "@slash-copilot/vue";
import router from "@/router";

const { isLoading } = useHandleSignInCallback(() => {
  router.push("/");
});
</script>

<template>
  <p v-if="isLoading">Redirecting...</p>
</template>
