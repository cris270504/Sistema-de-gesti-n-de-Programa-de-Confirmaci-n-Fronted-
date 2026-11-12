<script setup>
import LegalLayout from './LegalLayout.vue'

const CONTACTO = 'cristopher270504@gmail.com'
</script>

<template>
  <LegalLayout titulo="Política de privacidad" actualizado="12 de noviembre de 2026"
    descripcion="Cómo se tratan los datos personales en el Sistema de Gestión del Programa de Confirmación (SGPC): qué se guarda, para qué, quién lo ve y cómo ejercer tus derechos.">
    <p>
      El Sistema de Gestión del Programa de Confirmación (en adelante, «el sistema») es una herramienta que las
      parroquias usan para organizar sus programas de catequesis: inscripción de jóvenes, grupos, reuniones,
      asistencia, justificaciones y sacramentos. Esta política explica cómo se tratan los datos personales que se
      registran en él, conforme a la Ley N.° 29733, Ley de Protección de Datos Personales del Perú, y su reglamento.
    </p>

    <h2>1. Quién es responsable de los datos</h2>
    <ul>
      <li><b>Cada parroquia</b> es la titular de los datos que registra (de sus jóvenes, apoderados y agentes
        pastorales) y decide para qué los usa. Es ante ella que se ejercen los derechos descritos más abajo.</li>
      <li><b>El proveedor del sistema</b> presta el servicio tecnológico y trata los datos solo por encargo de la
        parroquia, para que el sistema funcione. No los vende, no los cede ni los usa para fines propios.</li>
    </ul>

    <h2>2. Qué datos se guardan</h2>
    <ul>
      <li><b>Usuarios del sistema</b> (catequistas, coordinadores y administradores): nombre, correo, DNI, celular,
        fecha de nacimiento, rol y grupos a cargo.</li>
      <li><b>Jóvenes del programa</b>: nombres y apellidos, fecha de nacimiento, género, celular, grupo, estado en
        el programa, sacramentos recibidos o pendientes, documentos entregados, asistencia y justificaciones.</li>
      <li><b>Apoderados</b>: nombres, apellidos, celular y relación con el joven.</li>
      <li><b>Datos técnicos</b>: registros de inicio de sesión, cambios hechos en el sistema (quién y cuándo) y
        errores de la aplicación, para seguridad y soporte.</li>
    </ul>
    <p>
      Muchos de los jóvenes son menores de edad. La parroquia es quien obtiene el consentimiento de sus padres o
      apoderados antes de registrar sus datos.
    </p>

    <h2>3. Para qué se usan</h2>
    <ul>
      <li>Organizar el programa: grupos, reuniones, cronograma y jornadas.</li>
      <li>Llevar la asistencia y las justificaciones, y avisar a tiempo cuando un joven acumula faltas.</li>
      <li>Hacer el seguimiento de los sacramentos y de los documentos requeridos.</li>
      <li>Comunicarse con los apoderados (por ejemplo, abrir un chat de WhatsApp desde el sistema).</li>
      <li>Mantener el sistema seguro y resolver problemas técnicos.</li>
    </ul>

    <h2>4. Quién puede verlos</h2>
    <p>
      Cada parroquia ve únicamente sus propios datos: el sistema separa la información de cada parroquia a nivel de
      base de datos. Dentro de la parroquia, cada persona ve solo lo que su rol le permite (por ejemplo, un catequista
      ve los jóvenes de sus grupos). El proveedor accede a los datos solo cuando hace falta para dar soporte o
      mantener el servicio.
    </p>

    <h2>5. Dónde se guardan</h2>
    <p>
      El sistema funciona sobre servicios en la nube de terceros: Supabase (base de datos, autenticación y archivos)
      y Vercel (publicación de la aplicación). Sus servidores pueden estar fuera del Perú, por lo que hay una
      transferencia internacional de datos. Estos proveedores cuentan con medidas de seguridad reconocidas y tratan
      los datos solo para prestar su servicio.
    </p>

    <h2>6. Cómo se protegen</h2>
    <ul>
      <li>Conexión cifrada (HTTPS) y contraseñas que no se guardan en texto legible.</li>
      <li>Reglas de acceso en la base de datos por parroquia y por rol.</li>
      <li>Inicio de sesión con límite de intentos y opción de entrar con huella o rostro.</li>
      <li>Copias de seguridad cifradas y registro de los cambios importantes.</li>
    </ul>

    <h2>7. Cuánto tiempo se conservan</h2>
    <p>
      Los datos se conservan mientras la parroquia use el sistema y los necesite para su programa. La parroquia puede
      descargar un respaldo completo en cualquier momento. Si deja de usar el sistema, sus datos se eliminan a su
      pedido.
    </p>

    <h2>8. Tus derechos</h2>
    <p>
      Puedes pedir acceder a tus datos (o a los de tu hijo o hija), corregirlos, cancelarlos u oponerte a su uso
      (derechos ARCO). Hazlo ante tu parroquia, que es la responsable. Si no obtienes respuesta, puedes escribir al
      proveedor a <a :href="`mailto:${CONTACTO}`">{{ CONTACTO }}</a>, y también presentar un reclamo ante la
      Autoridad Nacional de Protección de Datos Personales.
    </p>

    <h2>9. Almacenamiento en tu dispositivo</h2>
    <p>
      El sistema guarda en tu navegador lo necesario para mantener tu sesión y tus preferencias (por ejemplo, el tema
      claro u oscuro). No usa cookies de publicidad. Se recogen métricas anónimas de rendimiento para mejorar la
      velocidad de la aplicación.
    </p>

    <h2>10. Cambios a esta política</h2>
    <p>Si esta política cambia, se publicará aquí la nueva versión con su fecha de actualización.</p>
  </LegalLayout>
</template>
