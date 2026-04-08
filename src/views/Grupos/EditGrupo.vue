<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import HomeView from '../HomeView.vue'
import GrupoForm from '../../components/Modals/grupoModal.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))

function handleSaved() {
    router.push({ name: 'grupos' })
}
function handleCancel() {
    router.push({ name: 'grupos' })
}
</script>

<template>
    <HomeView />
    <GrupoForm :id="id" :key="id" @saved="handleSaved" @cancel="handleCancel" />
</template>