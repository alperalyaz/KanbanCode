<script setup lang="ts">
import robotAvatarCyan from "~/assets/images/hero/robots/robot-avatar-cyan-v1.webp";

const { t, locale } = useI18n();
const { repoUrl } = useGithubRepo();
const { baseURL } = useRuntimeConfig().app;
const year = new Date().getFullYear();
const docsHref = computed(() => {
  const base = baseURL.replace(/\/?$/, '/');
  return `${base}${locale.value === 'ru' ? 'docs/ru/' : 'docs/'}`;
});
</script>

<template>
  <footer class="app-footer">
    <img
      class="app-footer__robot"
      :src="robotAvatarCyan"
      alt=""
      loading="lazy"
      decoding="async"
      aria-hidden="true"
    >
    <v-container class="app-footer__inner">
      <span class="app-footer__copy"
        >{{ t('footer.copyright', { year }) }} · {{ t('footer.tagline') }}</span
      >
      <div class="app-footer__links">
        <a class="app-footer__link" href="https://github.com/777genius" target="_blank">Author</a>
        <span class="app-footer__divider" />
        <a class="app-footer__link" :href="repoUrl" target="_blank">GitHub</a>
        <span class="app-footer__divider" />
        <a class="app-footer__link" :href="docsHref">{{ t('footer.links.docs') }}</a>
      </div>
    </v-container>
  </footer>
</template>

<style scoped>
.app-footer {
  position: relative;
  border-top: 1px solid var(--at-c-border);
  padding: 20px 0;
  isolation: isolate;
}

.app-footer__robot {
  position: absolute;
  right: clamp(22px, 9vw, 148px);
  bottom: calc(100% - 4px);
  z-index: 2;
  width: clamp(76px, 6.2vw, 112px);
  height: auto;
  pointer-events: none;
  user-select: none;
  transform: translateY(14px) rotate(-2deg);
  transform-origin: center bottom;
  filter:
    drop-shadow(0 16px 22px rgba(0, 0, 0, 0.54))
    drop-shadow(0 0 18px rgba(0, 234, 255, 0.26));
}

.app-footer__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-footer__copy {
  font-size: 13px;
  opacity: 0.5;
  font-family: var(--at-font-mono);
}

.app-footer__links {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-footer__link {
  color: var(--at-c-cyan);
  text-decoration: none;
  font-size: 13px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  font-family: var(--at-font-mono);
}

.app-footer__link:hover {
  opacity: 1;
}

.app-footer__divider {
  width: 1px;
  height: 14px;
  background: var(--at-c-border-strong);
}

.v-theme--light .app-footer {
  border-top-color: var(--at-c-border);
}

.v-theme--light .app-footer__copy {
  opacity: 0.72;
}

.v-theme--light .app-footer__link {
  color: #007c8b;
  opacity: 1;
}

.v-theme--light .app-footer__link:hover {
  color: #005c66;
}

.v-theme--light .app-footer__divider {
  background: rgba(0, 128, 144, 0.26);
}

@media (max-width: 600px) {
  .app-footer__robot {
    display: none;
  }

  .app-footer__inner {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
}
</style>
