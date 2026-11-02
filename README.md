# Remédio Certo

Lembrete de medicamentos com confirmação de dose, pensado para idosos e cuidadores.

> **Status:** protótipo em HTML/JS (PWA). A versão final será reescrita em Flutter para Android e iOS.

## Sobre o projeto

Muitas pessoas com doenças crônicas esquecem ou tomam o remédio errado. O Remédio Certo ajuda a:

- cadastrar os remédios com horários, buscando o nome em uma lista de medicamentos registrados na Anvisa;
- receber um alerta no horário da dose, com botões grandes para **"Tomei"** e **"Adiar 10 min"**;
- avisar o cuidador (familiar) quando a dose não é confirmada;
- consultar a bula ampliada pelo Bulário Eletrônico da Anvisa;
- tirar dúvidas gerais sobre o remédio com um chatbot assistente, que não altera dose e não faz diagnóstico.

## Funcionalidades do MVP

1. **Cadastro de remédios:** nome com autocomplete, forma farmacêutica (comprimido, cápsula, gota, injeção) e horários. Foto da caixa opcional.
2. **Lembrete com confirmação:** notificação no horário, segundo aviso em 15 min e registro como "não confirmado" após 1 hora.
3. **Alerta ao cuidador:** aviso quando a dose não é confirmada (plano família).
4. **Bulário ampliado:** bula eletrônica com controle de tamanho da letra.
5. **Chatbot assistente:** explica o remédio e o modo de uso.
6. **Histórico:** doses tomadas, esquecidas e confirmadas.

## Telas

| Tela | Função |
|---|---|
| Início | Remédios do dia e status de cada dose |
| Adicionar remédio | Cadastro com autocomplete e horários |
| Alerta de dose | Botões "Tomei" e "Adiar 10 min" |
| Bulário | Bula com letra ampliada |
| Chatbot | Perguntas sobre o remédio |
| Histórico | Registro de doses |
| Configurações | Tamanho da letra, contraste e contato do cuidador |

## Acessibilidade

O público principal são pessoas idosas, muitas com baixa visão. Por isso:

- texto com no mínimo 18 px e controle de ampliação;
- contraste alto e status sempre com ícone e texto (nunca só cor);
- botões grandes, com área de toque ampla.

## Identidade visual

| Papel | Cor |
|---|---|
| Principal | `#0F766E` |
| Destaque | `#F97316` |
| Confirmado | `#16A34A` |
| Atrasado | `#DC2626` |
| Fundo | `#F8FAFC` |
| Texto | `#1E293B` |

Logo: `logo-remedio-certo.svg`. Ícone do app: `icone-app-remedio-certo.svg`.

## Como rodar

O protótipo não precisa de instalação. Basta abrir `index.html` em um navegador ou acessar a URL publicada no GitHub Pages.

Para testar como celular no computador:

1. Abra a página no Chrome.
2. Pressione **F12** e depois **Ctrl+Shift+M** (ou o ícone de celular).
3. Escolha um modelo de dispositivo.

Para instalar no celular, abra a mesma URL e escolha **"Adicionar à tela inicial"**.

## Limitações conhecidas do protótipo

- **Alerta com app fechado:** depende do app instalado na tela inicial e da permissão de notificação. No iPhone, exige iOS 16.4 ou mais novo.
- **Dados:** os dados ficam salvos no navegador. A sincronização com o cuidador exige um backend, que entra na versão Flutter.
- **Bulário:** a forma de exibição (dentro do app ou por link) ainda está em definição.
- **Chatbot:** o modo (respostas fixas ou IA) ainda está em definição.

## Fontes de dados

- Nomes e apresentações de medicamentos: dados abertos da Anvisa e da CMED.
- Bulas: Bulário Eletrônico da Anvisa.
- Fotos de embalagens: não há base oficial gratuita. O usuário fotografa a própria caixa.

## Aviso

O Remédio Certo **não substitui** médico, farmacêutico ou orientação profissional. O chatbot e a bula servem para informação geral. Em caso de dúvida, sintomas ou reações, procure um profissional de saúde.

## Autores

Joabe Carvalho Neco e Silva e colega de dupla (Projeto Integrador, Faculdade Estadual PIT).

## Licença

A definir.
