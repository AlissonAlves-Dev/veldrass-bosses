// Abertura da ENTRADA, no formato ISO. -03:00 significa Brasília.
// Não reinicie essas referências diariamente: o ciclo atravessa a meia-noite.
const bosses = [
  { id: "darius", name: "Darius Blackmane", level: 10, location: "Greenfall", anchor: "2026-09-08T03:30:00-03:00" },
  { id: "gorak", name: "Gorak, o Caçador", level: 20, location: "Ironhaven", anchor: "2026-09-08T05:48:00-03:00" },
  { id: "varkhan", name: "Varkhan Blackblade", level: 30, location: "Castelo de Dreadmoor", anchor: "2026-09-08T00:35:00-03:00" },
  { id: "morvanna", name: "Morvanna, Senhora do Lamaçal", level: 45, location: "Pântano Negro", anchor: "2026-09-08T02:00:00-03:00" },
  { id: "azrakar", name: "Azrakar, o Abissal", level: 70, location: "Ruínas Antigas", anchor: "2026-09-08T04:40:00-03:00" }
].map(boss => ({ ...boss, anchorMs: new Date(boss.anchor).getTime() }));
