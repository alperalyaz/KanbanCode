<script setup lang="ts">
import type { HeroMessage, HeroMessagePhase } from "~/data/heroScene";

const props = defineProps<{
  message: HeroMessage | null;
  phase: HeroMessagePhase;
  reducedMotion?: boolean;
}>();

const senderStyle = computed(() => ({
  "--bubble-x": props.message ? String(props.message.fromX) : "0",
  "--bubble-y": props.message ? String(props.message.fromY) : "0",
}));

const receiverStyle = computed(() => ({
  "--bubble-x": props.message ? String(props.message.toX) : "0",
  "--bubble-y": props.message ? String(props.message.toY) : "0",
}));

const showSender = computed(() =>
  props.message && props.message.from !== "reviewer" && (props.phase === "sender" || props.phase === "packet"),
);
const showReceiver = computed(() =>
  props.message && props.message.to !== "reviewer" && props.phase === "receiver",
);
</script>

<template>
  <div class="cyber-messages" aria-hidden="true">
    <Transition name="cyber-bubble">
      <div
        v-if="showSender && message && !reducedMotion"
        class="cyber-message cyber-message--sender"
        :class="`cyber-message--role-${message.from}`"
        :style="senderStyle"
      >
        {{ message.text }}
      </div>
    </Transition>

    <Transition name="cyber-bubble">
      <div
        v-if="showReceiver && message && !reducedMotion"
        class="cyber-message cyber-message--receiver"
        :class="`cyber-message--role-${message.to}`"
        :style="receiverStyle"
      >
        {{ message.response }}
      </div>
    </Transition>

    <div v-if="reducedMotion" class="cyber-message cyber-message--static cyber-panel">
      Agents coordinate work automatically.
    </div>
  </div>
</template>
