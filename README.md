# Apuração TSE

Painel React local para acompanhar **Flávio Bolsonaro e Lula**, no segundo turno da eleição presidencial de 2026. Os votos e percentuais vêm do arquivo oficial de abrangência Brasil do TSE.

## Rodar

Requer Node.js 22.15 ou superior.

```sh
npm install
npm run dev
```

Abra a URL local indicada pelo Vite (normalmente `http://localhost:5173`). Mantenha o terminal e a página abertos para acompanhar. Para encerrar, use `Ctrl+C` no terminal.

```sh
npm test        # valida a leitura das parciais e o histórico
npm run build  # verifica os tipos e gera dist/
```

## Atualizações e gráficos

- A primeira consulta ocorre ao abrir a página; as seguintes, 60 segundos depois da conclusão de cada consulta, sem sobreposição.
- O botão **Atualizar agora** permite uma consulta manual.
- O botão **Exportar gráfico** baixa uma imagem PNG de 1600 × 1110 pixels, com o gráfico de evolução, percentuais e votos dos dois candidatos, total de votos contabilizados, votos válidos, brancos, nulos e avanço das seções. A imagem informa a data e a hora da parcial em Brasília e usa todas as parciais salvas no navegador para o gráfico. A exportação não apaga o histórico e funciona localmente, sem serviços de imagem externos.
- A data e a hora em destaque são as da **geração do arquivo pelo TSE**, em Brasília. A hora da última consulta bem-sucedida aparece no rodapé.
- Se a parcial tiver mais de 3 minutos, aparece uma indicação de que o painel aguarda nova parcial. Isso não é uma estimativa de atraso garantido pelo TSE.
- Em falhas de rede ou resposta inválida, a última parcial permanece visível. Novas tentativas usam intervalos de 60, 120, 240 e até 300 segundos. Cada requisição tem limite de 15 segundos.
- As consultas automáticas param quando o próprio TSE informa a totalização final (`and=f`).
- Os percentuais são os publicados pelo TSE para votos válidos; não são recalculados sobre o total que inclui brancos e nulos.
- O gráfico registra novas parciais observadas neste navegador. O histórico é salvo em `localStorage`, limitado aos últimos 720 pontos. Ele não representa o histórico completo da eleição e não há dados fictícios ou projeções.
- O registro fica somente neste navegador e nesta origem local. Fechar a página interrompe a coleta, mas preserva o que já foi salvo; limpar os dados do navegador remove o histórico. Registros antigos mantêm seus percentuais; os votos destacados na imagem são os da parcial atual.
- O navegador e o sistema operacional podem reduzir a frequência de execução quando a aba ou o computador estiverem suspensos.

## Organização

```text
src/
  app/          página principal
  components/   cartões de candidatos, evolução e progresso
  config.ts     endereço do TSE e intervalos
  domain/       interpretação e validação dos dados; testes
  hooks/        consulta periódica e relógio da interface
  services/     acesso HTTP ao TSE
  utils/        formatação de números, datas e horários
  styles.css    aparência e adaptação da tela
```

Não precisa de chave de API nem de backend. A consulta é feita diretamente pelo navegador, com a permissão de acesso entre origens do TSE. O servidor local serve apenas o aplicativo React.

## Fonte

- [JSON oficial: presidente, Brasil, segundo turno de 2026](https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json)
- [Documentação técnica do TSE](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados)

A publicação das parciais e o cache dependem do TSE. Consultar novamente não garante que uma nova parcial já esteja disponível.
