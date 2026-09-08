# Boss Watch — construindo no seu computador

Código aberto para você ler e modificar, em HTML, CSS e JavaScript puros.
Esta cópia é independente do site anteriormente publicado e não o altera.

## 1. Rodar

1. Extraia o ZIP.
2. No VS Code, use Arquivo → Abrir Pasta e selecione boss-watch-local.
3. Abra Terminal → Novo Terminal. Ele deve estar na pasta que contém package.json.
4. Execute `node --version`. É necessário ter Node.js instalado (uma versão LTS atual). Se o comando não existir, instale pelo site oficial https://nodejs.org/ e reabra o VS Code.
5. Execute `npm start`.
6. Abra http://127.0.0.1:3000 no navegador.
7. Salve suas edições e recarregue a página. Ctrl+C no terminal encerra o servidor.

Não precisa executar npm install: não há dependências externas.
Não abra index.html com duplo clique; use o endereço servido acima.
Se a porta 3000 estiver ocupada, encerre o seu outro servidor ou altere a porta no final de server.mjs.
O servidor é somente para desenvolvimento e escuta apenas no próprio computador.

## 2. Entender os arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| public/index.html | Estrutura, títulos e botões |
| public/styles.css | Cores, espaçamentos e adaptação ao celular |
| public/bosses.js | Nomes, níveis, locais e horários de referência |
| public/app.js | Cálculo dos ciclos, renderização, som e notificações |
| public/manifest.webmanifest | Nome e ícones para instalação |
| public/sw.js | Cache offline e clique nas notificações |
| public/icons/ | Ícones do app |
| server.mjs | Servir a pasta public localmente |
| cycle.test.mjs | Testes das fronteiras de cada fase |

## 3. Construir e estudar em etapas

Você pode usar o projeto completo como referência ou criar outra pasta e copiar cada arquivo manualmente.

1. Leia index.html e identifique a área do próximo evento e o contêiner boss-grid.
2. Leia styles.css: as variáveis em :root controlam o tema. Experimente mudar --gold.
3. Abra bosses.js e identifique um objeto por boss. Mude um nome e veja o resultado ao recarregar.
4. Em app.js, estude primeiro as constantes e getBossState; depois createBossCards, updateCard e render.
5. Por último, veja os eventos dos botões, o manifest e o service worker. Eles não mudam a matemática do ciclo.

## 4. A regra, sem ambiguidade

O horário de referência é a abertura da entrada, não o começo da batalha.

| Fase | Intervalo desde o surgimento |
| --- | --- |
| Entrada aberta | 0 até antes de 10 minutos |
| Batalha | 10 até antes de 20 minutos |
| Espera | 20 até antes de 490 minutos |
| Novo surgimento | Exatamente aos 490 minutos |

10 + 10 + 470 = 490 minutos = 8h10.

Exemplo real: Darius abre em 08/09/2026 às 03:30; a entrada fecha às 03:40;
a batalha acaba às 03:50; ele surge novamente às 11:40.
O aviso dessa próxima entrada ocorre às 11:30, não às 11:40.
Os próximos surgimentos são 19:50 e 04:00 do dia seguinte.

O núcleo de getBossState usa:

```js
const elapsed = ((nowMs - boss.anchorMs) % CYCLE_DURATION + CYCLE_DURATION) % CYCLE_DURATION;
const cycleStart = nowMs - elapsed;
```

O resto da divisão indica quanto já passou dentro do ciclo atual.
O módulo positivo permite extrapolar para antes da data de referência:
essa data é uma ocorrência conhecida, não a criação do boss.
O contador é recalculado pelo relógio a cada atualização, evitando acumular atraso.

## 5. Editar a referência

Em public/bosses.js:

```js
anchor: "2026-09-08T03:30:00-03:00"
```

O formato é ano-mês-dia, T, horário e deslocamento de Brasília (-03:00).
Não substitua por uma data textual como 08/09/2026, cuja interpretação pode variar.
Não recadastre horários a cada dia. Corrija somente se houver uma nova referência real.
Não há integração com o jogo: reinícios, manutenção ou mudanças no ciclo exigem ajuste manual.
Mantenha data e hora do aparelho corretas.

## 6. Instalação e limites

Para testar a instalação no PC, abra em Chrome ou Edge e procure Instalar app
no painel ou o ícone de instalação na barra de endereços.
A oferta de instalação depende do navegador e do aparelho.

Para instalar no celular, o passo posterior é hospedar somente o conteúdo de public
em um endereço HTTPS. O localhost do PC não é o localhost do celular.
Não basta acessar um IP da rede por HTTP para obter todos os recursos da PWA.
Nenhuma publicação nova foi feita para entregar este pacote.

Offline: depois que o service worker terminar de preparar o cache, os arquivos ficam
disponíveis para uso sem rede. Isso não mantém o JavaScript executando em segundo plano.

IMPORTANTE: a primeira explicação foi otimista ao dizer que bastava minimizar.
Navegadores e celulares podem suspender abas, atrasar temporizadores e bloquear áudio.
Este código não garante alarmes com o app minimizado, fechado ou com o aparelho bloqueado.
Notificações com o app fechado exigem outra etapa com backend agendador e Web Push;
a entrega ainda depende da conexão, das permissões e do sistema.

Se voltar ao app faltando menos de 10 minutos, ele tenta avisar com o tempo restante
real. Não emite aviso antecipado atrasado depois que a entrada já abriu.

Referências oficiais:
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
- https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification
