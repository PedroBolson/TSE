# Apuração TSE

Painel React para acompanhar Flávio Bolsonaro e Lula no segundo turno presidencial de 2026. A coleta acontece no Firebase, independentemente de computadores ou navegadores abertos. O painel recebe as mudanças do Firestore em tempo real.

**Site:** https://tsebr-2df7b.web.app

## Rodar localmente

Requer Node.js 24.12 ou superior para o SDK web atual. A função publicada usa o runtime Node.js 22 do Firebase.

```sh
npm ci
npm run dev
```

A interface local, normalmente em `http://localhost:5173`, usa o mesmo Firestore do site hospedado. Não é necessário deixar esse servidor aberto para a coleta continuar.

## Coleta e armazenamento

- Uma Cloud Function de segunda geração, `collectTseResults`, roda a cada minuto em `southamerica-east1`, a mesma região do Firestore.
- O coletor usa 256 MiB, CPU fracionada, nenhuma instância mínima e no máximo uma instância. Cada consulta ao TSE tem limite de 15 segundos; a função, de 30 segundos.
- Cada identificador de parcial do TSE vira um único documento em `elections/6258/partials/{idg}`. A transação evita duplicatas e preserva o arquivo original do TSE.
- O documento `elections/6258` informa a última coleta bem-sucedida, a última parcial e possíveis erros. Uma resposta antiga de cache não faz a referência atual regredir.
- Em respostas HTTP 403 ou 429, o coletor espera 10 minutos antes de consultar o TSE novamente.
- O navegador só lê o Firestore. As regras permitem leitura dos resultados dessa eleição e bloqueiam gravação pelo cliente; a função usa o Admin SDK.
- Os percentuais são os publicados pelo TSE para votos válidos. Brancos e nulos aparecem separados do total de votos válidos.
- O painel mostra as últimas 720 parciais, mas a coleção na nuvem preserva todas as parciais que o coletor gravou.
- O horário em destaque é o da geração do arquivo pelo TSE, em Brasília. O rodapé informa o horário da última consulta bem-sucedida do coletor.
- O botão **Sincronizar agora** relê os dados do banco. Ele não dispara uma consulta extra ao TSE.
- O Firebase Analytics não é necessário para esse acompanhamento e não é inicializado.

## Encerrar a coleta

Para pausar o agendamento sem apagar o histórico, execute na pasta do projeto:

```sh
npm run collector:pause
```

Para reativar ou executar uma vez:

```sh
npm run collector:resume
npm run collector:run
```

Quando o próprio TSE informa a totalização final (`and=f`), a função deixa de consultar o TSE. O agendamento ainda pode invocar a função; use `collector:pause` para interromper essas invocações. Apenas chegar a 100% no percentual arredondado não é tratado como confirmação de totalização final.

Esses comandos usam o Google Cloud CLI autenticado, com o projeto e a região explicitamente definidos. Não é necessário excluir o projeto ou o Firestore para encerrar a coleta.

## Histórico local e exportação

O histórico que já existia em cada navegador continua salvo na mesma origem local e é combinado com as parciais da nuvem, sem duplicar pontos. Dados que existiam apenas no navegador não são enviados automaticamente ao banco. O site hospedado recebe o histórico da nuvem.

Fechar a página ou desligar o computador não interrompe mais a coleta. Ao abrir o painel novamente, ele recebe as parciais salvas enquanto você estava fora.

O botão **Exportar gráfico** baixa um PNG de 1600 × 1110 pixels, com evolução, votos e percentuais de cada candidato, totais, seções e horário da parcial. A escala vertical do gráfico e da imagem se ajusta aos percentuais de todas as parciais exibidas, com margem nas bordas e uma faixa mínima de 2 pontos percentuais. Os limites aparecem no eixo e na legenda da escala. Exportar não apaga o histórico. A exportação funciona no navegador, sem serviços de imagem externos.

## Validar e publicar

```sh
npm test
npm run build
npm --prefix functions ci
npm run build:functions
npm run deploy:firebase
```

O deploy publica somente a função do coletor, as regras do Firestore e o site deste projeto. As regras locais substituem as regras ativas do Firestore; alterações devem permanecer sincronizadas com este arquivo.

## Organização

```text
functions/src/       coletor agendado; usa o mesmo leitor de dados do painel
firestore.rules      leitura dos resultados; gravação reservada ao backend
firebase.json        configuração das Functions, regras e Hosting
src/app/             página principal
src/components/      cartões, gráfico de evolução e andamento
src/domain/          interpretação dos dados, histórico, exportação e testes
src/hooks/           assinatura em tempo real e estado da interface
src/services/        conexão com Firebase e consultas ao Firestore
src/utils/           formatação e download do gráfico
```

## Fontes

- [JSON oficial do TSE](https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json)
- [Documentação técnica do TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados)

A publicação das parciais e o cache continuam dependendo do TSE. Uma coleta bem-sucedida não significa que uma nova parcial já tenha sido publicada.
