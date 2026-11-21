# Veldrass Tools — Boss Watch e Calculadora de farm

Site de ferramentas para jogadores do [Veldrass](https://veldrass.com), em HTML, CSS e JavaScript puros, sem dependências.
Não é um site oficial do jogo e não tem conexão com ele.

**Site no ar:** https://veldrass-tools.vercel.app

- **[Boss Watch](https://veldrass-tools.vercel.app/)** (`/`): horários e contagem regressiva dos world bosses, no horário de Brasília.
- **[Calculadora de farm](https://veldrass-tools.vercel.app/calculadora/)** (`/calculadora/`): compara dois builds (atributos e marcas do Bestiário) por XP/h, ouro/h e horas por item.

## 1. Rodar no seu computador

1. Instale uma versão LTS do [Node.js](https://nodejs.org/) e abra a pasta do projeto no terminal (a que contém `package.json`).
2. Execute `npm start`.
3. Abra http://127.0.0.1:3000 no navegador.
4. Salve suas edições e recarregue a página. Ctrl+C encerra o servidor.

Não precisa de `npm install`. Não abra os arquivos com duplo clique: use o endereço servido acima.
O servidor serve a pasta `public/` e imita a rota `/api/time` da Vercel, então a sincronização de horário funciona localmente.
Para trocar a porta: `PORT=3100 npm start` (no PowerShell: `$env:PORT=3100; npm start`).
O servidor é só para desenvolvimento e escuta apenas no próprio computador.

Testes: `npm test`.

## 2. Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `public/index.html` | Página do Boss Watch |
| `public/styles.css` | Tema e componentes compartilhados pelas duas páginas |
| `public/bosses.js` | Nomes, níveis, locais e horários de referência dos bosses |
| `public/app.js` | Ciclos, sincronização do horário, renderização do Boss Watch |
| `public/calculadora/index.html` | Página da calculadora |
| `public/calculadora/data.js` | Dados de monstros e caçadas, lidos do `config/game.php` do jogo |
| `public/calculadora/calc-core.js` | Regras fixas, classes e simulação (sem DOM, coberto por teste) |
| `public/calculadora/calc.js` | Interface da calculadora |
| `public/calculadora/calc.css` | Estilo da calculadora, em cima das variáveis do `styles.css` |
| `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` | PWA: instalação e cache offline |
| `api/time.js` | Função da Vercel que devolve a hora do servidor |
| `server.mjs` | Servidor local de desenvolvimento |
| `vercel.json` | Cabeçalhos de segurança e rota `/calculadora` |
| `cycle.test.mjs`, `calc.test.mjs` | Testes do ciclo dos bosses e da calculadora |

## 3. A regra do ciclo dos bosses

O horário de referência é a **abertura da entrada**, não o começo da batalha.

| Fase | Intervalo desde o surgimento |
| --- | --- |
| Entrada aberta | 0 até antes de 10 minutos |
| Batalha | 10 até antes de 20 minutos |
| Espera | 20 até antes de 490 minutos |
| Novo surgimento | Exatamente aos 490 minutos |

10 + 10 + 470 = 490 minutos = 8h10. Isso corresponde ao jogo: o próximo boss começa 8 h depois do fim da batalha (batalha de 10 min + 8 h de espera).

Exemplo: Darius abre em 08/09/2026 às 03:30; a entrada fecha às 03:40; a batalha acaba às 03:50; ele surge de novo às 11:40.

O núcleo de `getBossState` usa:

```js
const elapsed = ((nowMs - boss.anchorMs) % CYCLE_DURATION + CYCLE_DURATION) % CYCLE_DURATION;
const cycleStart = nowMs - elapsed;
```

O módulo positivo permite calcular também antes da data de referência.
O contador é recalculado pelo relógio a cada atualização, sem acumular atraso.

### Horário do servidor

O site pede a hora a `/api/time` e compensa a latência da rede (usa metade do tempo de ida e volta). Se a primeira sincronização falhar, a tela usa o relógio do aparelho **com um aviso vermelho** e tenta de novo a cada 30 s. Se já havia uma referência, ela é mantida.

### Editar a referência

Em `public/bosses.js`:

```js
anchor: "2026-09-08T03:30:00-03:00"
```

Formato: ano-mês-dia, `T`, horário e deslocamento de Brasília (`-03:00`).
Não há integração com o jogo: manutenção, reinício do servidor ou um evento forçado por administrador mudam o ciclo real e exigem novo ajuste manual.
Corrija somente com uma nova referência real, observada no jogo.

## 4. Calculadora de farm

> **Desativada para os usuários por enquanto.** O código continua em `public/calculadora/`, mas no site publicado `/calculadora` redireciona para `/`, o link saiu do menu e o service worker não a guarda em cache. Para reativar: restaurar o link em `public/index.html`, trocar os `redirects` do `vercel.json` pelo `rewrite` de `/calculadora` → `/calculadora/index.html` e voltar os arquivos da calculadora ao `APP_SHELL` do `public/sw.js` (subindo a versão do cache).

- Compara dois cenários (A e B) para classe, atributos, marcas do Bestiário e caçada.
- Os modificadores de classe e as regras do jogo (🔒) são fixos e congelados no código; só os dados do seu personagem são editáveis.
- Os valores ficam salvos no navegador. "Copiar link com meus valores" gera um link com o seu cenário.
- A simulação foi calibrada com um painel de Status real de um Mago nível 111 (XP/h e abates/h), mas as classes Guerreiro e Arqueiro não foram calibradas com dados reais.
- Dados de monstros e caçadas vêm do `config/game.php` de 2026-11-20. Se o jogo for rebalanceado, atualize `public/calculadora/data.js`.

## 5. Publicação (Vercel)

O site é publicado na Vercel em https://veldrass-tools.vercel.app a partir da pasta `public/`; a função `api/time.js` vira `/api/time` automaticamente.
O endereço antigo `veldrass-bosses.vercel.app` redireciona para o atual.
`vercel.json` acrescenta cabeçalhos de segurança e, enquanto a calculadora está desativada, redireciona `/calculadora` para `/`.
O workflow antigo do GitHub Pages foi removido: o Pages não tem `/api/time`, então o site publicado por ele não conseguia sincronizar o horário.

Para instalar como app (PWA) é preciso HTTPS, como na Vercel. O cache offline guarda os arquivos, mas **não** mantém o JavaScript rodando em segundo plano: navegadores e celulares podem suspender abas e atrasar temporizadores. Este código não envia notificações nem alarmes; isso exigiria um backend agendador com Web Push.

## 6. Créditos e aviso

Veldrass é de seus criadores; o uso do nome foi autorizado pelo dono do jogo, com link para o jogo no rodapé de todas as páginas.
