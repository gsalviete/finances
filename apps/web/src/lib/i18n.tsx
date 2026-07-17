'use client';

/**
 * i18n + preferências de exibição (Settings §3.7: language, currency, timezone,
 * motionLevel). Fonte de verdade da tradução na borda: dicionários pt-BR/en-US.
 * O contexto default (sem provider) é pt-BR/BRL/America-SP — testes e SSR
 * renderizam idêntico ao comportamento anterior.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Money, type MotionLevel } from '@finances/shared';

export type Lang = 'pt-BR' | 'en-US';

const pt = {
  // navegação / shell
  'nav.home': 'Início',
  'nav.transactions': 'Transações',
  'nav.planning': 'Planejamento',
  'nav.categories': 'Categorias',
  'nav.inbox': 'Inbox',
  'nav.wishlist': 'Wishlist',
  'nav.backup': 'Backup',
  'nav.settings': 'Ajustes',
  'nav.logout': 'Sair',
  'nav.open': 'Abrir menu',
  'nav.close': 'Fechar menu',
  'nav.main': 'Navegação principal',
  'brand.tagline': 'Quanto eu ainda posso gastar até o final deste mês?',
  'theme.label': 'Tema',
  'theme.light': 'Claro',
  'theme.dark': 'Escuro',
  'theme.system': 'Sistema',
  'lang.switch': 'Idioma',
  'common.loading': 'Carregando',
  'common.retry': 'Tentar de novo',

  // home / dashboard
  'home.loadError': 'Não foi possível carregar o painel.',
  'home.loadingAria': 'Carregando painel',
  'hero.question': 'Quanto ainda posso gastar este mês',
  'hero.dailyBudget': 'Gasto diário recomendado',
  'hero.daysRemaining': '{n} dia(s) restante(s) em {m}/{y}',
  'hero.aria': 'Saldo Projetado',
  'hero.ringAria': 'Progresso do mês',
  'hero.ringCaption': 'restantes',
  'lens.current': 'Saldo Atual (caixa confirmado)',
  'lens.planned': 'Planejado (intenção do mês)',
  'lens.projection': 'Projeção de encerramento*',
  'lens.projectionNote': '*estimativa linear, não é certeza',
  'pacing.title': 'Ritmo do gasto variável',
  'pacing.aria': 'Ritmo financeiro',
  'pacing.COMFORTABLE': 'Confortável',
  'pacing.ON_TRACK': 'Dentro do esperado',
  'pacing.ATTENTION': 'Atenção',
  'pacing.CRITICAL': 'Crítico',
  'pacing.text':
    'Você gastou {actual} de um ritmo esperado de {expected} até hoje{pct}. Estimativa linear.',
  'recent.title': 'Últimas movimentações',
  'recent.aria': 'Últimas movimentações',
  'recent.empty': 'Nenhuma movimentação ainda — registre a primeira em Transações.',
  'top.title': 'Maiores categorias do mês',
  'top.aria': 'Categorias mais utilizadas',
  'top.empty': 'Sem gastos confirmados neste mês.',
  'status.CONFIRMED': 'Confirmada',
  'status.FORECAST': 'Prevista',
  'status.CANCELLED': 'Cancelada',
  'tx.noDescription': 'sem descrição',

  // transações
  'tx.eyebrow': 'Registro diário',
  'tx.pageTitle': 'Transações',
  'tx.pageSubtitle': 'Registrar um gasto leva menos de dez segundos.',
  'tx.formTitle': 'Registrar movimentação',
  'tx.newAria': 'Nova movimentação',
  'tx.listAria': 'Lista de transações',
  'tx.type': 'Tipo',
  'tx.expense': 'Despesa',
  'tx.income': 'Receita',
  'tx.amount': 'Valor ({currency})',
  'tx.amountPlaceholder': '123,45',
  'tx.date': 'Data',
  'tx.category': 'Categoria',
  'tx.select': 'Selecione…',
  'tx.description': 'Descrição',
  'tx.descPlaceholder': 'ex.: mercado',
  'tx.installments': 'Parcelas',
  'tx.cash': 'À vista',
  'tx.forecast': 'Prevista (ainda não ocorreu)',
  'tx.register': 'Registrar',
  'tx.created': 'Movimentação registrada.',
  'tx.createdInstallments': 'Compra registrada em {n}x com soma exata.',
  'tx.invalidAmount': 'Valor inválido (use {example})',
  'tx.listTitle': 'Movimentações',
  'tx.filterAria': 'Filtrar por status',
  'tx.filterAll': 'Todas',
  'tx.filterConfirmed': 'Confirmadas',
  'tx.filterForecast': 'Previstas',
  'tx.filterCancelled': 'Canceladas',
  'tx.thDate': 'Data',
  'tx.thDescription': 'Descrição',
  'tx.thStatus': 'Status',
  'tx.thAmount': 'Valor',
  'tx.thActions': 'Ações',
  'tx.confirm': 'Confirmar',
  'tx.cancel': 'Cancelar',
  'tx.delete': 'Excluir',
  'tx.deleteConfirm': 'Excluir "{name}"?',
  'tx.fallbackName': 'movimentação',
  'tx.empty': 'Nenhuma movimentação encontrada.',
  'tx.loadMore': 'Carregar mais',

  // planejamento
  'plan.eyebrow': 'Intenção do mês',
  'plan.pageTitle': 'Planejamento',
  'plan.pageSubtitle': 'Congele o mês antes de ele começar.',
  'plan.assistantAria': 'Assistente de início de mês',
  'plan.planAria': 'Plano do mês',
  'plan.startTitle': 'Iniciar {m}/{y}',
  'plan.startText':
    'O assistente congela suas recorrências no plano do mês e cria as movimentações esperadas — a Home responde certo desde o dia 1º.',
  'plan.investment': 'Investimento',
  'kind.INCOME': 'Receita',
  'kind.EXPENSE': 'Despesa',
  'kind.INVESTMENT': 'Investimento',
  'plan.day': '(dia {n})',
  'plan.emptyRules':
    'Nenhuma recorrência cadastrada — o plano nascerá vazio e você adiciona itens manualmente.',
  'plan.confirmStart': 'Confirmar e iniciar o mês',
  'plan.title': 'Plano de {m}/{y}',
  'plan.archived': 'arquivado',
  'plan.addItem': 'Item',
  'plan.save': 'Salvar',
  'plan.empty': 'Plano sem itens — adicione compromissos previsíveis.',
  'plan.thKind': 'Tipo',
  'plan.thDescription': 'Descrição',
  'plan.thCategory': 'Categoria',
  'plan.thAmount': 'Valor ({currency})',
  'plan.thStatus': 'Status',
  'plan.kindAria': 'Tipo do item',
  'plan.descAria': 'Descrição do item',
  'plan.categoryAria': 'Categoria do item',
  'plan.amountAria': 'Valor do item',
  'plan.actionsAria': 'Ações',
  'plan.paid': 'Pago',
  'plan.pending': 'Pendente',
  'plan.remove': 'Remover item',
  'plan.saved': 'Plano atualizado — indicadores recalculados na próxima leitura.',
  'plan.invalid': 'Valores inválidos (use {example})',

  // categorias
  'cat.eyebrow': 'Organização',
  'cat.pageTitle': 'Categorias',
  'cat.pageSubtitle': 'Customizáveis e arquiváveis — nunca perdem histórico.',
  'cat.newTitle': 'Nova categoria',
  'cat.newAria': 'Nova categoria',
  'cat.listAria': 'Lista de categorias',
  'cat.name': 'Nome',
  'cat.color': 'Cor',
  'color.green': 'verde',
  'color.blue': 'azul',
  'color.purple': 'roxo',
  'color.orange': 'laranja',
  'color.pink': 'rosa',
  'color.yellow': 'amarelo',
  'color.red': 'vermelho',
  'cat.create': 'Criar',
  'cat.created': 'Categoria criada.',
  'cat.createError': 'Erro ao criar',
  'cat.deleted': 'Categoria excluída (soft delete).',
  'cat.deleteError': 'Erro ao excluir',
  'cat.deleteConfirm': 'Excluir a categoria "{name}"?',
  'cat.listTitle': 'Categorias',
  'cat.showArchived': 'Mostrar arquivadas',
  'cat.empty': 'Nenhuma categoria — crie a primeira acima.',
  'cat.archivedBadge': 'arquivada',
  'cat.temporary': 'temporária',
  'cat.archive': 'Arquivar',
  'cat.restore': 'Restaurar',
  'cat.delete': 'Excluir',

  // inbox
  'inbox.eyebrow': 'Automação',
  'inbox.pageTitle': 'Inbox',
  'inbox.pageSubtitle': 'Nada entra no orçamento sem a sua revisão.',
  'inbox.aria': 'Inbox de automação',
  'inbox.text':
    'Notificações capturadas pelo Atalho aguardando sua revisão. Nenhuma entra no orçamento sem confirmação.',
  'inbox.empty': 'Inbox vazia — nenhuma notificação pendente.',
  'inbox.confidence': 'confiança {p}%',
  'inbox.review': ' — revisar',
  'inbox.noAmount': 'valor não identificado',
  'inbox.categoryPlaceholder': 'Categoria…',
  'inbox.categoryAria': 'Categoria para confirmar',
  'inbox.confirm': 'Confirmar',
  'inbox.ignore': 'Ignorar',
  'inbox.willRegister': 'Será registrada como despesa confirmada de {v}',

  // backup
  'backup.eyebrow': 'Seus dados',
  'backup.pageTitle': 'Backup',
  'backup.pageSubtitle': 'Exportar, restaurar e guardar — seus dados são seus.',
  'backup.exportAria': 'Exportar dados',
  'backup.importAria': 'Importar dados',
  'backup.runAria': 'Backup manual',
  'backup.exportTitle': 'Exportar meus dados',
  'backup.exportText':
    'ZIP com transações, categorias, planejamentos, recorrências e preferências. Nunca inclui senha ou dados sensíveis.',
  'backup.exportBtn': 'Exportar ZIP',
  'backup.exportDone': 'Export gerado — o download começou.',
  'backup.exportError': 'Erro no export',
  'backup.importTitle': 'Importar (restaurar)',
  'backup.importText':
    'Estratégia REPLACE: o conteúdo do arquivo substitui integralmente os dados atuais. Arquivo inválido é rejeitado sem tocar em nada.',
  'backup.fileAria': 'Arquivo de backup',
  'backup.importCheck': 'Entendo que meus dados atuais serão substituídos',
  'backup.importBtn': 'Importar e substituir',
  'backup.importDone': 'Import concluído: seus dados foram SUBSTITUÍDOS pelo conteúdo do arquivo.',
  'backup.importError': 'Erro no import',
  'backup.runTitle': 'Backup agora',
  'backup.runText':
    'Grava um artefato pelo provedor configurado (Local em dev, Object Storage em produção) e registra os metadados.',
  'backup.runBtn': 'Executar backup',
  'backup.runDone': 'Backup gravado via {provider}: {location}',
  'backup.runError': 'Erro no backup',

  // ajustes
  'set.eyebrow': 'Sua conta',
  'set.pageTitle': 'Ajustes',
  'set.pageSubtitle': 'O app se adapta a você — tema, idioma, moeda e movimento.',
  'set.aria': 'Preferências',
  'set.title': 'Preferências',
  'set.theme': 'Tema',
  'set.currency': 'Moeda (ISO 4217)',
  'set.language': 'Idioma',
  'set.langPt': 'Português (Brasil)',
  'set.langEn': 'English (US)',
  'set.timezone': 'Timezone (IANA)',
  'set.backup': 'Frequência de backup',
  'set.daily': 'Diário',
  'set.weekly': 'Semanal',
  'set.monthly': 'Mensal',
  'set.motion': 'Animações',
  'set.motionFull': 'Completas',
  'set.motionReduced': 'Reduzidas',
  'set.motionNone': 'Nenhuma',
  'set.save': 'Salvar',
  'set.saved': 'Preferências salvas.',
  'set.nothing': 'Nada para salvar.',
  'set.error': 'Erro ao salvar',

  // wishlist (ADR-018)
  'wish.eyebrow': 'Lista de desejos',
  'wish.pageTitle': 'Wishlist',
  'wish.pageSubtitle': 'Cole o link do produto — nome, preço e imagem vêm sozinhos.',
  'wish.newTitle': 'Adicionar desejo',
  'wish.newAria': 'Novo item da wishlist',
  'wish.url': 'Link do produto',
  'wish.urlPlaceholder': 'https://…',
  'wish.priority': 'Prioridade',
  'wish.prio.HIGH': 'Alta',
  'wish.prio.MEDIUM': 'Média',
  'wish.prio.LOW': 'Baixa',
  'wish.add': 'Adicionar',
  'wish.added': 'Item adicionado à wishlist.',
  'wish.addedPartial': 'Item adicionado — a extração não trouxe tudo; complete manualmente.',
  'wish.addError': 'Erro ao adicionar item',
  'wish.listTitle': 'Meus desejos',
  'wish.listAria': 'Itens da wishlist',
  'wish.empty': 'Nenhum desejo ainda — cole o link de um produto acima.',
  'wish.noPrice': 'informe o preço',
  'wish.noImage': 'Sem imagem',
  'wish.openLink': 'Abrir página do produto',
  'wish.refresh': 'Atualizar preço e imagem',
  'wish.refreshed': 'Item atualizado a partir da página.',
  'wish.refreshError': 'Erro ao atualizar item',
  'wish.edit': 'Editar item',
  'wish.name': 'Nome',
  'wish.price': 'Preço ({currency})',
  'wish.save': 'Salvar',
  'wish.cancel': 'Cancelar',
  'wish.updated': 'Item atualizado.',
  'wish.updateError': 'Erro ao salvar item',
  'wish.delete': 'Remover item',
  'wish.deleteConfirm': 'Remover "{name}" da wishlist?',
  'wish.deleted': 'Item removido.',
  'wish.deleteError': 'Erro ao remover item',
  'wish.scrapedAt': 'Capturado em {date}',

  // login
  'login.name': 'Nome',
  'login.email': 'Email',
  'login.password': 'Senha',
  'login.wait': 'Aguarde…',
  'login.signIn': 'Entrar',
  'login.create': 'Criar conta',
  'login.toRegister': 'Primeiro acesso? Criar conta',
  'login.toLogin': 'Já tenho conta',
  'login.unexpected': 'Erro inesperado',
} as const;

export type MessageKey = keyof typeof pt;

const en: Record<MessageKey, string> = {
  'nav.home': 'Home',
  'nav.transactions': 'Transactions',
  'nav.planning': 'Planning',
  'nav.categories': 'Categories',
  'nav.inbox': 'Inbox',
  'nav.wishlist': 'Wishlist',
  'nav.backup': 'Backup',
  'nav.settings': 'Settings',
  'nav.logout': 'Sign out',
  'nav.open': 'Open menu',
  'nav.close': 'Close menu',
  'nav.main': 'Main navigation',
  'brand.tagline': 'How much can I still spend before the month ends?',
  'theme.label': 'Theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'lang.switch': 'Language',
  'common.loading': 'Loading',
  'common.retry': 'Try again',

  'home.loadError': 'The dashboard could not be loaded.',
  'home.loadingAria': 'Loading dashboard',
  'hero.question': 'How much can I still spend this month',
  'hero.dailyBudget': 'Recommended daily spend',
  'hero.daysRemaining': '{n} day(s) left in {m}/{y}',
  'hero.aria': 'Projected balance',
  'hero.ringAria': 'Month progress',
  'hero.ringCaption': 'left',
  'lens.current': 'Current balance (confirmed cash)',
  'lens.planned': 'Planned (this month’s intent)',
  'lens.projection': 'End-of-month projection*',
  'lens.projectionNote': '*linear estimate, not a promise',
  'pacing.title': 'Variable spending pace',
  'pacing.aria': 'Financial pace',
  'pacing.COMFORTABLE': 'Comfortable',
  'pacing.ON_TRACK': 'On track',
  'pacing.ATTENTION': 'Attention',
  'pacing.CRITICAL': 'Critical',
  'pacing.text':
    'You spent {actual} against an expected pace of {expected} so far{pct}. Linear estimate.',
  'recent.title': 'Latest activity',
  'recent.aria': 'Latest activity',
  'recent.empty': 'No activity yet — record your first one in Transactions.',
  'top.title': 'Top categories this month',
  'top.aria': 'Most used categories',
  'top.empty': 'No confirmed spending this month.',
  'status.CONFIRMED': 'Confirmed',
  'status.FORECAST': 'Forecast',
  'status.CANCELLED': 'Cancelled',
  'tx.noDescription': 'no description',

  'tx.eyebrow': 'Daily ledger',
  'tx.pageTitle': 'Transactions',
  'tx.pageSubtitle': 'Recording an expense takes under ten seconds.',
  'tx.formTitle': 'Record activity',
  'tx.newAria': 'New activity',
  'tx.listAria': 'Transaction list',
  'tx.type': 'Type',
  'tx.expense': 'Expense',
  'tx.income': 'Income',
  'tx.amount': 'Amount ({currency})',
  'tx.amountPlaceholder': '123.45',
  'tx.date': 'Date',
  'tx.category': 'Category',
  'tx.select': 'Select…',
  'tx.description': 'Description',
  'tx.descPlaceholder': 'e.g. groceries',
  'tx.installments': 'Installments',
  'tx.cash': 'One-time',
  'tx.forecast': 'Forecast (hasn’t happened yet)',
  'tx.register': 'Record',
  'tx.created': 'Activity recorded.',
  'tx.createdInstallments': 'Purchase recorded in {n} installments with an exact sum.',
  'tx.invalidAmount': 'Invalid amount (use {example})',
  'tx.listTitle': 'Activity',
  'tx.filterAria': 'Filter by status',
  'tx.filterAll': 'All',
  'tx.filterConfirmed': 'Confirmed',
  'tx.filterForecast': 'Forecast',
  'tx.filterCancelled': 'Cancelled',
  'tx.thDate': 'Date',
  'tx.thDescription': 'Description',
  'tx.thStatus': 'Status',
  'tx.thAmount': 'Amount',
  'tx.thActions': 'Actions',
  'tx.confirm': 'Confirm',
  'tx.cancel': 'Cancel',
  'tx.delete': 'Delete',
  'tx.deleteConfirm': 'Delete "{name}"?',
  'tx.fallbackName': 'activity',
  'tx.empty': 'No activity found.',
  'tx.loadMore': 'Load more',

  'plan.eyebrow': 'Monthly intent',
  'plan.pageTitle': 'Planning',
  'plan.pageSubtitle': 'Freeze the month before it starts.',
  'plan.assistantAria': 'Month start assistant',
  'plan.planAria': 'Monthly plan',
  'plan.startTitle': 'Start {m}/{y}',
  'plan.startText':
    'The assistant freezes your recurring rules into this month’s plan and creates the expected activity — Home answers correctly from day one.',
  'plan.investment': 'Investment',
  'kind.INCOME': 'Income',
  'kind.EXPENSE': 'Expense',
  'kind.INVESTMENT': 'Investment',
  'plan.day': '(day {n})',
  'plan.emptyRules': 'No recurring rules yet — the plan starts empty and you add items manually.',
  'plan.confirmStart': 'Confirm and start the month',
  'plan.title': 'Plan for {m}/{y}',
  'plan.archived': 'archived',
  'plan.addItem': 'Item',
  'plan.save': 'Save',
  'plan.empty': 'The plan has no items — add predictable commitments.',
  'plan.thKind': 'Type',
  'plan.thDescription': 'Description',
  'plan.thCategory': 'Category',
  'plan.thAmount': 'Amount ({currency})',
  'plan.thStatus': 'Status',
  'plan.kindAria': 'Item type',
  'plan.descAria': 'Item description',
  'plan.categoryAria': 'Item category',
  'plan.amountAria': 'Item amount',
  'plan.actionsAria': 'Actions',
  'plan.paid': 'Paid',
  'plan.pending': 'Pending',
  'plan.remove': 'Remove item',
  'plan.saved': 'Plan updated — indicators recalculate on the next read.',
  'plan.invalid': 'Invalid amounts (use {example})',

  'cat.eyebrow': 'Organization',
  'cat.pageTitle': 'Categories',
  'cat.pageSubtitle': 'Customizable and archivable — history is never lost.',
  'cat.newTitle': 'New category',
  'cat.newAria': 'New category',
  'cat.listAria': 'Category list',
  'cat.name': 'Name',
  'cat.color': 'Color',
  'color.green': 'green',
  'color.blue': 'blue',
  'color.purple': 'purple',
  'color.orange': 'orange',
  'color.pink': 'pink',
  'color.yellow': 'yellow',
  'color.red': 'red',
  'cat.create': 'Create',
  'cat.created': 'Category created.',
  'cat.createError': 'Could not create the category',
  'cat.deleted': 'Category deleted (soft delete).',
  'cat.deleteError': 'Could not delete the category',
  'cat.deleteConfirm': 'Delete the category "{name}"?',
  'cat.listTitle': 'Categories',
  'cat.showArchived': 'Show archived',
  'cat.empty': 'No categories — create the first one above.',
  'cat.archivedBadge': 'archived',
  'cat.temporary': 'temporary',
  'cat.archive': 'Archive',
  'cat.restore': 'Restore',
  'cat.delete': 'Delete',

  'inbox.eyebrow': 'Automation',
  'inbox.pageTitle': 'Inbox',
  'inbox.pageSubtitle': 'Nothing enters the budget without your review.',
  'inbox.aria': 'Automation inbox',
  'inbox.text':
    'Notifications captured by the Shortcut, waiting for your review. Nothing enters the budget without confirmation.',
  'inbox.empty': 'Inbox is empty — no pending notifications.',
  'inbox.confidence': 'confidence {p}%',
  'inbox.review': ' — review',
  'inbox.noAmount': 'amount not detected',
  'inbox.categoryPlaceholder': 'Category…',
  'inbox.categoryAria': 'Category to confirm',
  'inbox.confirm': 'Confirm',
  'inbox.ignore': 'Ignore',
  'inbox.willRegister': 'Will be recorded as a confirmed expense of {v}',

  'backup.eyebrow': 'Your data',
  'backup.pageTitle': 'Backup',
  'backup.pageSubtitle': 'Export, restore and store — your data is yours.',
  'backup.exportAria': 'Export data',
  'backup.importAria': 'Import data',
  'backup.runAria': 'Manual backup',
  'backup.exportTitle': 'Export my data',
  'backup.exportText':
    'A ZIP with transactions, categories, plans, recurring rules and preferences. Never includes passwords or sensitive data.',
  'backup.exportBtn': 'Export ZIP',
  'backup.exportDone': 'Export ready — the download has started.',
  'backup.exportError': 'Export failed',
  'backup.importTitle': 'Import (restore)',
  'backup.importText':
    'REPLACE strategy: the file’s content fully replaces your current data. An invalid file is rejected without touching anything.',
  'backup.fileAria': 'Backup file',
  'backup.importCheck': 'I understand my current data will be replaced',
  'backup.importBtn': 'Import and replace',
  'backup.importDone': 'Import finished: your data was REPLACED by the file’s content.',
  'backup.importError': 'Import failed',
  'backup.runTitle': 'Back up now',
  'backup.runText':
    'Writes an artifact through the configured provider (Local in dev, Object Storage in production) and records the metadata.',
  'backup.runBtn': 'Run backup',
  'backup.runDone': 'Backup written via {provider}: {location}',
  'backup.runError': 'Backup failed',

  'set.eyebrow': 'Your account',
  'set.pageTitle': 'Settings',
  'set.pageSubtitle': 'The app adapts to you — theme, language, currency and motion.',
  'set.aria': 'Preferences',
  'set.title': 'Preferences',
  'set.theme': 'Theme',
  'set.currency': 'Currency (ISO 4217)',
  'set.language': 'Language',
  'set.langPt': 'Português (Brasil)',
  'set.langEn': 'English (US)',
  'set.timezone': 'Timezone (IANA)',
  'set.backup': 'Backup frequency',
  'set.daily': 'Daily',
  'set.weekly': 'Weekly',
  'set.monthly': 'Monthly',
  'set.motion': 'Motion',
  'set.motionFull': 'Full',
  'set.motionReduced': 'Reduced',
  'set.motionNone': 'None',
  'set.save': 'Save',
  'set.saved': 'Preferences saved.',
  'set.nothing': 'Nothing to save.',
  'set.error': 'Could not save',

  'login.name': 'Name',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.wait': 'One moment…',
  'login.signIn': 'Sign in',
  'login.create': 'Create account',
  'login.toRegister': 'First time here? Create account',
  'login.toLogin': 'I already have an account',
  'login.unexpected': 'Unexpected error',

  'wish.eyebrow': 'Wish list',
  'wish.pageTitle': 'Wishlist',
  'wish.pageSubtitle': 'Paste the product link — name, price and image come in automatically.',
  'wish.newTitle': 'Add a wish',
  'wish.newAria': 'New wishlist item',
  'wish.url': 'Product link',
  'wish.urlPlaceholder': 'https://…',
  'wish.priority': 'Priority',
  'wish.prio.HIGH': 'High',
  'wish.prio.MEDIUM': 'Medium',
  'wish.prio.LOW': 'Low',
  'wish.add': 'Add',
  'wish.added': 'Item added to your wishlist.',
  'wish.addedPartial': 'Item added — extraction was incomplete; fill in the rest manually.',
  'wish.addError': 'Could not add item',
  'wish.listTitle': 'My wishes',
  'wish.listAria': 'Wishlist items',
  'wish.empty': 'No wishes yet — paste a product link above.',
  'wish.noPrice': 'add a price',
  'wish.noImage': 'No image',
  'wish.openLink': 'Open product page',
  'wish.refresh': 'Refresh price and image',
  'wish.refreshed': 'Item refreshed from the page.',
  'wish.refreshError': 'Could not refresh item',
  'wish.edit': 'Edit item',
  'wish.name': 'Name',
  'wish.price': 'Price ({currency})',
  'wish.save': 'Save',
  'wish.cancel': 'Cancel',
  'wish.updated': 'Item updated.',
  'wish.updateError': 'Could not save item',
  'wish.delete': 'Remove item',
  'wish.deleteConfirm': 'Remove "{name}" from your wishlist?',
  'wish.deleted': 'Item removed.',
  'wish.deleteError': 'Could not remove item',
  'wish.scrapedAt': 'Captured on {date}',
};

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { 'pt-BR': pt, 'en-US': en };

export const LANG_COOKIE = 'finances-lang';

export function normalizeLang(value: string | undefined | null): Lang {
  if (!value) return 'pt-BR';
  return value.toLowerCase().startsWith('en') ? 'en-US' : 'pt-BR';
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (raw, name: string) =>
    name in vars ? String(vars[name]) : raw,
  );
}

export interface I18n {
  lang: Lang;
  currency: string;
  timezone: string;
  motionLevel: MotionLevel;
  setLang(lang: Lang): void;
  /** Aplica preferências vindas de GET /settings (Shell sincroniza ao logar). */
  syncFromSettings(settings: {
    language?: string;
    currency?: string;
    timezone?: string;
    motionLevel?: MotionLevel;
  }): void;
  t(key: MessageKey, vars?: Record<string, string | number>): string;
  fmtCents(cents: number): string;
  fmtDate(iso: string | Date): string;
  /** Data local (timezone do usuário) de um instante — para inputs type=date. */
  dateInputValue(instant: Date): string;
}

const DEFAULTS = {
  lang: 'pt-BR' as Lang,
  currency: 'BRL',
  timezone: 'America/Sao_Paulo',
  motionLevel: 'FULL' as MotionLevel,
};

function buildI18n(
  state: { lang: Lang; currency: string; timezone: string; motionLevel: MotionLevel },
  setLang: (lang: Lang) => void,
  syncFromSettings: I18n['syncFromSettings'],
): I18n {
  const { lang, currency, timezone, motionLevel } = state;
  return {
    lang,
    currency,
    timezone,
    motionLevel,
    setLang,
    syncFromSettings,
    t: (key, vars) => interpolate(MESSAGES[lang][key], vars),
    fmtCents: (cents) => Money.fromCents(cents).format(lang, currency),
    fmtDate: (iso) =>
      new Intl.DateTimeFormat(lang, {
        timeZone: timezone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(typeof iso === 'string' ? new Date(iso) : iso),
    dateInputValue: (instant) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(instant),
  };
}

/** Sem provider (testes, SSR estático), o comportamento é o default pt-BR/BRL. */
const I18nContext = createContext<I18n>(
  buildI18n(
    DEFAULTS,
    () => undefined,
    () => undefined,
  ),
);

export function I18nProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang?: string;
}) {
  const [state, setState] = useState(() => ({
    ...DEFAULTS,
    lang: normalizeLang(initialLang),
  }));

  // idioma reflete no <html lang> e num cookie (primeiro paint SSR correto)
  useEffect(() => {
    document.documentElement.lang = state.lang;
    document.cookie = `${LANG_COOKIE}=${state.lang};path=/;max-age=31536000`;
  }, [state.lang]);

  // motionLevel NONE também desliga transições CSS (ver globals.css)
  useEffect(() => {
    document.documentElement.dataset.motion = state.motionLevel;
  }, [state.motionLevel]);

  const setLang = useCallback((lang: Lang) => {
    setState((prev) => (prev.lang === lang ? prev : { ...prev, lang }));
  }, []);

  const syncFromSettings = useCallback<I18n['syncFromSettings']>((settings) => {
    setState((prev) => {
      const next = {
        ...prev,
        lang: settings.language ? normalizeLang(settings.language) : prev.lang,
        currency: settings.currency ?? prev.currency,
        timezone: settings.timezone ?? prev.timezone,
        motionLevel: settings.motionLevel ?? prev.motionLevel,
      };
      const changed =
        next.lang !== prev.lang ||
        next.currency !== prev.currency ||
        next.timezone !== prev.timezone ||
        next.motionLevel !== prev.motionLevel;
      return changed ? next : prev;
    });
  }, []);

  const value = useMemo(
    () => buildI18n(state, setLang, syncFromSettings),
    [state, setLang, syncFromSettings],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
