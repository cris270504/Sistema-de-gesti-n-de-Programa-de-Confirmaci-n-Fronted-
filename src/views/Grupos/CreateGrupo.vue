<script setup>
import { useRouter } from 'vue-router'
import HomeView from '../HomeView.vue'
import GrupoForm from '../../components/Modals/grupoModal.vue'

const router = useRouter()

function handleSaved() {
  router.push({ name: 'grupos' })
}
function handleCancel() {
  router.push({ name: 'grupos' })
}
</script>

<template>
  <HomeView />
  <GrupoForm @saved="handleSaved" @cancel="handleCancel" />
</template>