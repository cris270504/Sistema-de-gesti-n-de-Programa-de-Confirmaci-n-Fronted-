<script setup>
import { RouterLink } from 'vue-router'
import LegalLayout from './LegalLayout.vue'

const CONTACTO = 'cristopher270504@gmail.com'
</script>

<template>
  <LegalLayout titulo="Términos y condiciones" actualizado="12 de noviembre de 2026"
    descripcion="Condiciones de uso del Sistema de Gestión del Programa de Confirmación (SGPC) para parroquias y sus usuarios.">
    <p>
      Estos términos regulan el uso del Sistema de Gestión del Programa de Confirmación (en adelante, «el sistema»)
      por parte de las parroquias que lo contratan y de las personas a las que ellas dan acceso. Al usar el sistema
      aceptas estas condiciones y la <RouterLink :to="{ name: 'privacidad' }">Política de privacidad</RouterLink>.
    </p>

    <h2>1. El servicio</h2>
    <p>
      El sistema permite a cada parroquia gestionar su programa de catequesis: jóvenes, apoderados, grupos,
      reuniones, asistencia, justificaciones, sacramentos y reportes. Se ofrece en línea y puede instalarse como
      aplicación en el celular. El proveedor puede mejorarlo o cambiar funciones, procurando no afectar el trabajo de
      las parroquias.
    </p>

    <h2>2. Cuentas y acceso</h2>
    <ul>
      <li>Cada parroquia tiene un administrador que crea las cuentas de su equipo y define sus roles.</li>
      <li>Cada cuenta es personal. No compartas tu contraseña; si sospechas que alguien la conoce, cámbiala en «Mi
        perfil» o pide al administrador que la restablezca.</li>
      <li>La parroquia es responsable de dar de baja a quienes ya no deban tener acceso.</li>
    </ul>

    <h2>3. Uso correcto</h2>
    <ul>
      <li>Registra solo datos necesarios para el programa y con el consentimiento que corresponda, en especial
        cuando se trata de menores de edad.</li>
      <li>No intentes acceder a datos de otras parroquias, vulnerar la seguridad del sistema ni usarlo para fines
        ajenos a la pastoral.</li>
      <li>Los datos que descargues (reportes y respaldos) quedan bajo tu responsabilidad: guárdalos de forma segura.</li>
    </ul>

    <h2>4. Datos de la parroquia</h2>
    <p>
      Los datos registrados pertenecen a la parroquia. El proveedor los trata solo para prestar el servicio, según la
      Política de privacidad. La parroquia puede descargar un respaldo completo en cualquier momento y pedir la
      eliminación de sus datos al dejar el servicio.
    </p>

    <h2>5. Disponibilidad</h2>
    <p>
      El proveedor procura que el sistema esté disponible de forma continua, pero puede haber interrupciones por
      mantenimiento (que se avisan en pantalla) o por fallas de los servicios en la nube de los que depende.
    </p>

    <h2>6. Responsabilidad</h2>
    <p>
      El sistema es una herramienta de apoyo: las decisiones pastorales y administrativas (por ejemplo, retirar a un
      joven del programa) corresponden a la parroquia. El proveedor no responde por el uso indebido de las cuentas ni
      por información registrada de forma incorrecta.
    </p>

    <h2>7. Suspensión</h2>
    <p>
      El acceso de una parroquia puede suspenderse si incumple estos términos o las condiciones de su contratación. Se
      avisará con anticipación siempre que sea posible.
    </p>

    <h2>8. Contacto</h2>
    <p>
      Para dudas sobre estos términos escribe a <a :href="`mailto:${CONTACTO}`">{{ CONTACTO }}</a>. Estos términos se
      rigen por las leyes de la República del Perú.
    </p>
  </LegalLayout>
</template>
