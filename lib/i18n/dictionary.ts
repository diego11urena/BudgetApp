/**
 * The shape every dictionary (en.ts, es.ts) must satisfy. Grouped by
 * screen/feature so the file mirrors app/'s own route structure -- makes
 * it easy to find "the strings for X" while translating or wiring a new
 * component. Templated/pluralized strings are functions, not raw strings
 * with placeholders: a function's parameter list is checked by the
 * compiler the same as any other call site, so a translation that drops
 * or misuses a variable is a type error, not a silent runtime bug.
 */
/**
 * The pay-cadence-aware vocabulary every "quincena"-containing dictionary
 * key will be parameterized with (see Dictionary.periodVocab below and the
 * Phase 11.5 copy sweep) -- rather than quadrupling the whole dictionary
 * (2 languages x 2 cadences), just this small slice of period-specific
 * words gets duplicated per cadence, and every other string interpolates
 * from it. English needs no grammatical care ("this quincena"/"this month"
 * takes no gender agreement); Spanish does -- "esta quincena" (feminine) vs
 * "este mes" (masculine) changes the article on every adjacent phrase, not
 * just the noun, so each Spanish field is written whole, not assembled
 * from noun + a shared article.
 */
export type PeriodVocab = {
  /** "quincena" | "month" / "mes" */
  noun: string;
  /** "quincenas" | "months" / "meses" */
  nounPlural: string;
  /** "this quincena" / "esta quincena" | "this month" / "este mes" */
  thisPeriod: string;
  /** "next quincena" / "próxima quincena" | "next month" / "próximo mes" */
  nextPeriod: string;
  /** "last quincena" / "quincena pasada" | "last month" / "mes pasado" */
  lastPeriod: string;
  /** "current quincena" / "quincena actual" | "current month" / "mes actual" */
  currentPeriodAdj: string;
  /** "quincenal" | "monthly" / "mensual" */
  adjective: string;
  /** "every quincena" / "cada quincena" | "every month" / "cada mes" */
  everyPeriod: string;
};

export type Dictionary = {
  /** Keyed by the account's own payFrequency (lowercased) -- see lib/quincena-pace.ts's PayFrequency for the source enum this mirrors. */
  periodVocab: { quincenal: PeriodVocab; monthly: PeriodVocab };

  common: {
    save: string;
    saving: string;
    cancel: string;
    delete: string;
    deleting: string;
    edit: string;
    continue: string;
    back: string;
    loading: string;
    invalidInput: string;
    genericError: string;
    tooManyAttempts: (seconds: number) => string;
    optional: string;
    confirm: string;
    close: string;
    /** Shared by the onboarding cadence picker and Profile's PayFrequencyRow -- one pair of labels, not duplicated per screen. */
    payFrequency: { quincenal: string; monthly: string };
    /** Shared by the two top-level ("use client") error boundaries -- app/error.tsx and app/(app)/error.tsx -- whose title/retry text is identical to app/(onboarding)/error.tsx's own onboarding.error.title/retry (reused directly from there), but whose body copy is distinct per screen. */
    error: {
      appBody: string;
      rootBody: string;
    };
  };

  nav: {
    home: string;
    activity: string;
    plan: string;
    profile: string;
    addTransaction: string;
  };

  landing: {
    navHowItWorks: string;
    navFeatures: string;
    navPricing: string;
    navPrimary: string;
    logIn: string;
    getStarted: string;
    eyebrow: (vocab: PeriodVocab) => string;
    h1: string;
    subDesktop: string;
    subMobile: (vocab: PeriodVocab) => string;
    trustLineDesktop: string;
    trustLineMobile: string;
    alreadyHaveAccount: string;
    checklistSetup: string;
    checklistBills: string;
    checklistGmail: string;
    deviceLeftThisQuincena: (vocab: PeriodVocab) => string;
    deviceGroceries: string;
    deviceTransport: string;
    deviceSavingsGoal: string;
    deviceNextQuincena: (vocab: PeriodVocab) => string;
    feature1Title: string;
    feature1Body: string;
    feature2Title: string;
    feature2Body: string;
    feature3Title: string;
    feature3Body: string;
    howItWorks: string;
    ctaTitle: (vocab: PeriodVocab) => string;
    ctaBody: string;
    footerCopyright: string;
    footerPrivacy: string;
    footerTerms: string;
    footerSupport: string;
  };

  auth: {
    backToHome: string;
    login: {
      title: string;
      subtitle: (vocab: PeriodVocab) => string;
      metaTitle: string;
      emailLabel: string;
      passwordLabel: string;
      forgot: string;
      showPassword: string;
      hidePassword: string;
      submitting: string;
      submit: string;
      or: string;
      gmailButton: string;
      gmailComingSoon: string;
      newToBalboa: string;
      createAccount: string;
      invalidCredentials: string;
    };
    signup: {
      title: (vocab: PeriodVocab) => string;
      subtitle: string;
      metaTitle: string;
      nameLabel: string;
      emailLabel: string;
      passwordLabel: string;
      passwordHint: string;
      submitting: string;
      submit: string;
      alreadyHaveAccount: string;
      logIn: string;
      emailTaken: string;
    };
    forgotPassword: {
      metaTitle: string;
      title: string;
      subtitle: string;
      backToLogin: string;
    };
  };

  onboarding: {
    stepBack: (step: string) => string;
    stepNames: { income: string; expenses: string; goal: string };
    error: { title: string; body: string; retry: string };
    complete: { metaTitle: string; title: string; redirecting: (vocab: PeriodVocab) => string };
    income: {
      metaTitle: string;
      kicker: string;
      question: string;
      explainer: (vocab: PeriodVocab) => string;
      label: (vocab: PeriodVocab) => string;
      hint: (vocab: PeriodVocab) => string;
      saving: string;
      continue: string;
      /** The cadence picker's own label -- above the two payFrequency options (see common.payFrequency). */
      cadenceLabel: string;
    };
    expenses: {
      metaTitle: string;
      kicker: string;
      question: string;
      explainer: (vocab: PeriodVocab) => string;
      untitled: string;
      recurring: (dueDay: number | null) => string;
      removeAria: (name: string) => string;
      namePlaceholder: string;
      amountPlaceholder: string;
      billNameAria: string;
      dueDayAria: string;
      dueDayOption: string;
      addButton: string;
      suggestionChip: (name: string) => string;
      suggestions: { phone: string; netflix: string; spotify: string; gym: string; insurance: string };
      tipLabel: string;
      tipBody: string;
      saving: string;
      continueWithBills: (count: number) => string;
      continueNoBills: string;
      skip: string;
    };
    goal: {
      metaTitle: string;
      kicker: string;
      question: string;
      explainer: string;
      nameLabel: string;
      namePlaceholder: string;
      alreadySavedLabel: string;
      targetLabel: string;
      perQuincenaLabel: (vocab: PeriodVocab) => string;
      perQuincenaHint: string;
      projection: (vocab: PeriodVocab, amount: string, date: string) => string;
      saving: string;
      createAndFinish: string;
      finishSetup: string;
      finishing: string;
      skip: string;
    };
  };

  dashboard: {
    metaTitle: string;
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    greeting: (greeting: string, name: string) => string;
    dateRange: (vocab: PeriodVocab, range: string) => string;
    heroFinalAvailable: string;
    heroSafeToSpend: string;
    heroAvailableSummary: (left: string, pendingBills: string) => string;
    heroDaysLeft: (n: number) => string;
    heroPacePerDay: (perDay: string) => string;
    heroLastDay: (amount: string) => string;
    heroCycleEnded: (vocab: PeriodVocab, date: string) => string;
    closingQuincena: (vocab: PeriodVocab) => string;
    iJustGotPaid: string;
    insightsTitle: string;
    needsAttention: (n: number) => string;
    review: string;
    finishTransactionsTitle: string;
    finishTransactionsBody: string;
    doneForNow: string;
    sentTo: (name: string) => string;
    receivedFrom: (name: string) => string;
    chooseCategoryPlaceholder: string;
    chooseCategoryError: string;
    tellUsWhatItWasForError: string;
    thisIsABill: string;
    whatWasThisForPlaceholder: string;
    saving: string;
    save: string;
    howMuchPaid: string;
    becomesIncome: (vocab: PeriodVocab) => string;
    netPayLabel: string;
    confirmSaving: string;
    confirm: string;
    skip: string;
    noIncomeSource: string;
    quincenaNotFound: (vocab: PeriodVocab) => string;
    paydayOverdue: (vocab: PeriodVocab, date: string) => string;
    statIncome: string;
    statSpent: string;
    statSaved: string;
    statBillsLeft: string;
    bills: string;
    billsPaidOfTotal: (paid: number, total: number) => string;
    pendingAmount: (amount: string) => string;
    baseExtra: (base: string, extra: string) => string;
    thisQuincena: (vocab: PeriodVocab) => string;
    percentOfIncome: (percent: number) => string;
    goalsFunded: (n: number) => string;
    billsUnpaid: (n: number, total: number) => string;
    topCategoriesTitle: (vocab: PeriodVocab) => string;
    /** TopCategoriesChart's default title on a past/closed cycle's own page (History) -- "this quincena"/"this month" doesn't read correctly there, so this is the period-neutral fallback the component's own doc comment calls for. */
    topCategoriesTitlePlain: string;
    noExpensesYet: (vocab: PeriodVocab) => string;
    top6Badge: string;
    tapToLogFirst: string;
    whereItsGoing: string;
    recent: string;
    seeAll: string;
    closeQuincena: {
      title: (vocab: PeriodVocab) => string;
      body: (vocab: PeriodVocab) => string;
      whenPaid: string;
      yes: string;
      cancel: string;
    };
    cycleClosed: {
      aria: (vocab: PeriodVocab) => string;
      title: (vocab: PeriodVocab) => string;
      spent: string;
      saved: string;
      rolledOver: string;
      topCategory: (name: string) => string;
      overBudgetBy: (amount: string) => string;
      onBudget: string;
      streak: (vocab: PeriodVocab, n: number) => string;
      continue: string;
    };
    editPayInfo: {
      edit: string;
      title: string;
      hintNoMove: (vocab: PeriodVocab) => string;
      hintMayMove: (vocab: PeriodVocab) => string;
      netPayLabel: string;
      payDateLabel: string;
      dateRequired: string;
      invalidDate: string;
      dateNotFuture: string;
      dateRange: (min: string, max: string) => string;
      /** assessPayDateChange's own boundary errors (lib/cycles.ts) -- distinct wording from the client-side `dateRange` above (that one guards the date INPUT's min/max attributes; these guard the actual server-side neighbor-cycle overlap check). */
      payDateAfter: (min: string) => string;
      payDateAfterAndBefore: (min: string, max: string) => string;
      startOfHistory: string;
      moveWarning: (vocab: PeriodVocab, n: number, direction: string, cycleLabel: string) => string;
      into: string;
      outOf: string;
      from: string;
      to: string;
      saving: string;
      continue: string;
      cancel: string;
      save: string;
    };
  };

  transactions: {
    metaTitle: string;
    title: string;
    seeWhereItWent: string;
    count: (n: number) => string;
    noMatch: string;
    noneYet: string;
    /** TransactionList's own default emptyMessage — distinct from `noneYet` (used elsewhere for a plain "no transactions at all" state); this one is specifically the current-quincena empty state. */
    nothingLoggedThisQuincena: (vocab: PeriodVocab) => string;
    /** lib/transaction-grouping.ts's date-group headers -- everything older falls back to a plain formatted date, which stays unlocalized (see lib/format.ts's own comment on that decision). */
    today: string;
    yesterday: string;
    /** TransactionRowContent's sub-line fallback for a row with no linked category ("Needs a category"), distinct from `filters.uncategorized` (a filter-chip label). */
    needsCategory: string;
    /** Trailing text next to TransactionRowContent's lock icon on a closed-cycle row -- lowercase, mid-sentence ("· closed"), not the standalone `history.closed` badge label. */
    closedTag: string;
    filters: {
      all: string;
      searchPlaceholder: string;
      searchAria: string;
      typeAria: string;
      quincenaAria: (vocab: PeriodVocab) => string;
      currentQuincena: (vocab: PeriodVocab) => string;
      categoryAria: string;
      category: string;
      uncategorized: string;
    };
    breakdown: {
      metaTitle: string;
      backToActivity: string;
      title: string;
      subtitle: (vocab: PeriodVocab) => string;
      fullPaycheck: string;
      spendingOnly: string;
      thisQuincena: (vocab: PeriodVocab) => string;
      lastQuincena: (vocab: PeriodVocab) => string;
      noPreviousQuincena: (vocab: PeriodVocab) => string;
      nothingToShow: string;
      categoryCount: (n: number) => string;
      notYetSpent: (vocab: PeriodVocab) => string;
      groupCount: (n: number) => string;
      noTransactions: string;
      seeAll: string;
      chartAria: string;
      sliceAria: (label: string, amount: string, percent: number) => string;
    };
  };

  plan: {
    metaTitle: string;
    title: string;
    bills: {
      title: string;
      newBill: string;
      empty: string;
      paidOfTotal: (vocab: PeriodVocab, paid: string, total: string) => string;
    };
    goals: {
      title: string;
      empty: string;
    };
  };

  quickAdd: {
    editAria: string;
    logAria: string;
    merchantRequired: string;
    categoryRequired: string;
    dateRequired: string;
    dateNotFuture: string;
    dateWithinQuincena: (vocab: PeriodVocab) => string;
    /** addTransactionAction's own plain-create path -- combines dateWithinQuincena and dateNotFuture into the one message that path actually returns. */
    dateWithinQuincenaNotFuture: (vocab: PeriodVocab) => string;
    logged: (amount: string, label: string) => string;
    undo: string;
    savedError: string;
    deleted: (amount: string, name: string) => string;
    amountLabel: string;
    merchantLabel: string;
    merchantPlaceholder: string;
    categoryLabel: string;
    chooseCategoryOption: string;
    newCategoryOption: string;
    /** CategoryNameInput's own dropdown option, templated with the typed value -- distinct from the plain static `newCategoryOption` (a <select>'s own "+ New category…" entry). */
    createNew: (value: string) => string;
    newCategoryPlaceholder: string;
    paymentMethodLabel: string;
    noPaymentMethod: string;
    dateLabel: string;
    noteLabel: string;
    fewerDetails: string;
    moreDetails: string;
    thisIsABill: string;
    notePlaceholder: string;
    moveWarning: (vocab: PeriodVocab, rangeText: string) => string;
    moving: string;
    continue: string;
    cancel: string;
    saving: string;
    logging: string;
    saveChanges: string;
    logIt: string;
    deletingTx: string;
    deleteTransaction: string;
    /** app/(app)/_actions/transactions.ts's own server-side error strings -- shared across addTransactionAction/updateTransactionAction/categorizeTransactionAction/describeTransactionAction/deleteTransactionAction/restoreTransactionAction. */
    missingTransaction: string;
    transactionNotFound: string;
    categoryIsRequired: string;
    quincenaClosedCantEdit: (vocab: PeriodVocab) => string;
    recurringLinkRemoved: string;
    /** restoreTransactionAction's own "Cycle not found" -- distinct wording from dashboard.quincenaNotFound, which addTransactionAction's cycle lookup uses instead. */
    restoreCycleNotFound: string;
    /** restoreTransactionAction's malformed-toast-snapshot guard. */
    invalidUndoPayload: string;
  };

  budget: {
    over: (amount: string) => string;
    recordPayment: {
      title: (name: string) => string;
      amountLabel: string;
      paymentMethodLabel: string;
      noPaymentMethod: string;
      savedError: string;
      logging: string;
      record: string;
      cancel: string;
    };
    recurringEdit: {
      titleEdit: string;
      titleNew: string;
      nameLabel: string;
      namePlaceholder: string;
      amountLabel: string;
      categoryLabel: string;
      categoryPlaceholder: string;
      recurrenceLabel: string;
      /** The BIWEEKLY option -- "every cycle," by definition (see lib/cycles.ts's shouldCarryForwardToCycle). Relabeled per the account's own payFrequency so it never says "quincena" for a monthly-cadence account. */
      everyQuincena: (vocab: PeriodVocab) => string;
      monthly: string;
      oneTime: string;
      dueDayLabel: string;
      saving: string;
      save: string;
      deleted: string;
      undo: string;
      delete: string;
      cancel: string;
    };
    status: {
      notPaid: string;
      partiallyPaid: string;
      paid: string;
      paidOverTarget: string;
      exceeded: string;
    };
    dueDay: (day: number) => string;
    record: string;
    possibleMatch: (name: string, amount: string) => string;
    confirming: string;
    confirmMatch: string;
    notThisOne: string;
    recordPaymentButton: string;
    /** Internal consistency-error messages surfaced by recurring-actions.ts's server actions -- not heavily user-facing (they indicate a stale/tampered request, not a normal validation failure), but still rendered in-app rather than left in English. */
    errors: {
      missingRecurringExpense: string;
      recurringExpenseNotFound: string;
      invalidUndoPayload: string;
      cycleNotFound: string;
      invalidAmount: string;
      missingTransaction: string;
      transactionNotFound: string;
      categoryMismatch: string;
    };
  };

  goals: {
    addGoal: string;
    addOrUpdate: string;
    logNote: string;
    contribute: string;
    contributingTo: (name: string) => string;
    amountLabel: string;
    logged: (amount: string, name: string) => string;
    undo: string;
    logging: string;
    editTitle: string;
    goalNameLabel: string;
    totalGoalLabel: string;
    perCycleLabel: string;
    optionalPlaceholder: string;
    alreadySavedLabel: string;
    nameRequired: string;
    savedError: string;
    increaseConfirm: (amount: string) => string;
    decreaseConfirm: (amount: string) => string;
    saving: string;
    recordAsTransaction: string;
    recordAsWithdrawal: string;
    justUpdate: string;
    cancel: string;
    save: string;
    goalNamePlaceholder: string;
    perCyclePlaceholder: string;
    alreadySavedQuestion: string;
    alreadySavedPlaceholder: string;
    saveGoal: string;
    savedOf: (saved: string, target: string) => string;
    reached: string;
    onTrack: (amount: string, date: string) => string;
    setContribution: string;
    edit: string;
    removeAria: (name: string) => string;
    removing: string;
    remove: string;
    deleted: string;
    undoRemove: string;
    nameTaken: (name: string) => string;
    concurrentEdit: string;
    percentSaved: (percent: number) => string;
    missingGoal: string;
    notFound: string;
    invalidUndoPayload: string;
  };

  history: {
    metaTitle: string;
    title: string;
    empty: (vocab: PeriodVocab) => string;
    left: (amount: string) => string;
    detailMetaTitle: (vocab: PeriodVocab) => string;
    back: string;
    closed: string;
    active: string;
    bills: string;
    transactions: string;
    empty2: (vocab: PeriodVocab) => string;
    addToQuincena: (vocab: PeriodVocab) => string;
  };

  profile: {
    metaTitle: string;
    title: string;
    memberSince: (date: string) => string;
    gmailError: string;
    gmailRateLimited: string;
    yourData: string;
    pastQuincenas: (vocab: PeriodVocab) => string;
    manageCategories: string;
    account: string;
    signOutEverywhere: string;
    signOutEverywhereHint: string;
    dangerZone: string;
    signOut: string;
    developerTools: string;
    theme: string;
    /** Display labels for the System/Light/Dark picker's three options -- distinct from lib/theme.ts's own THEME_LABEL, which stays English-only since it's also used as a plain internal identifier in a couple of dev/debug spots; this is the one shown to a real user. */
    themeLabels: { system: string; light: string; dark: string };
    language: string;
    /** PayFrequencyRow's own row label -- the two option labels themselves are shared via common.payFrequency. */
    payFrequency: string;
    changePassword: {
      row: string;
      title: string;
      currentLabel: string;
      newLabel: string;
      confirmLabel: string;
      mismatch: string;
      updated: string;
      saving: string;
      submit: string;
      accountNotFound: string;
      currentPasswordIncorrect: string;
    };
    devReset: {
      confirm: string;
      button: string;
    };
    eraseCycles: {
      button: string;
      hint: string;
      confirmTitle: string;
      confirmBody: (vocab: PeriodVocab) => string;
      erasing: string;
      yes: string;
      cancel: string;
    };
    gmail: {
      title: string;
      body: string;
      scopeNote: string;
      connect: string;
      connectedAs: (email: string) => string;
      lastSynced: (date: string) => string;
      notSynced: string;
      reconnect: string;
      disconnect: string;
      syncing: string;
      on: string;
      synced: (time: string, email: string) => string;
    };
    categories: {
      metaTitle: string;
      title: string;
      incomeMetaTitle: string;
      incomeTitle: string;
      back: string;
      manageIncomeLink: string;
      searchPlaceholder: string;
      searchAria: string;
      yourCategories: string;
      incomeCategories: string;
      addAria: string;
      noCategories: string;
      noMatch: (query: string) => string;
      noActiveCheckUnused: string;
      unusedCount: (n: number) => string;
      noUnusedMatch: (query: string) => string;
      recurringNoTx: string;
      noTx: string;
      txCount: (n: number, amount: string) => string;
      actionsAria: (name: string) => string;
      actions: { edit: string; mergeInto: string; delete: string; cancel: string };
      duplicates: (n: number) => string;
      review: string;
      categoryNotFound: string;
      missingCategory: string;
      invalidCategoryType: string;
      form: {
        nameRequired: string;
        titleEdit: string;
        titleAdd: string;
        iconAria: string;
        nameLabel: string;
        defaultIconName: string;
        saving: string;
        save: string;
        cancel: string;
        invalidIcon: string;
        nameExists: (name: string) => string;
        nameExistsMergeHint: (name: string) => string;
      };
      deleteConfirm: {
        title: (name: string) => string;
        willBecomeUncategorized: (n: number) => string;
        budgetHistoryDeleted: string;
        cannotBeUndone: string;
        noHistoryNoUndo: string;
        deleting: string;
        delete: string;
        cancel: string;
        hasRecurringHistory: (vocab: PeriodVocab) => string;
      };
      iconPicker: {
        title: string;
        searchPlaceholder: string;
        searchAria: string;
        noMatch: (query: string) => string;
        cancel: string;
      };
      merge: {
        title: (source: string, target: string) => string;
        genericTitle: string;
        sourceLabel: string;
        targetLabel: string;
        chooseOption: string;
        continue: string;
        cancel: string;
        bodyWithTx: (n: number, target: string) => string;
        bodyNoTx: (target: string) => string;
        cannotBeUndone: string;
        merging: string;
        mergeButton: string;
        sameTypeRequired: string;
        pickTarget: string;
        pickDifferentCategories: string;
      };
    };
  };

  /**
   * lib/insights.ts's own rule-generated Insight[] text -- a plain function
   * (no useT() available), so its caller (dashboard/page.tsx) threads a
   * Dictionary["insights"] through as a parameter instead. One templated
   * function per distinct sentence shape a rule can produce; dueSoonCandidate's
   * "due X" fragment is its own set of keys since it's composed into
   * billDueSoon rather than a full sentence on its own.
   */
  insights: {
    dueToday: string;
    dueTomorrow: string;
    dueInDays: (n: number) => string;
    wasDueYesterday: string;
    wasDueDaysAgo: (n: number) => string;
    billDueSoon: (name: string, amount: string, dueText: string) => string;
    unpaidRecurring: (count: number, remaining: string) => string;
    duplicateCharge: (amount: string, name: string, date: string) => string;
    categoryAnomaly: (categoryName: string, amount: string) => string;
    categoryDelta: (categoryName: string, amount: string) => string;
    overBudget: (amount: string, days: number) => string;
    runOutOfCash: (date: string, days: number) => string;
    onTrackPace: string;
    savingsGoalClose: (amount: string, name: string) => string;
    goalContributionBehind: (vocab: PeriodVocab, planned: string, actual: string, name: string, days: number) => string;
  };

  validations: {
    invalidAmount: string;
    amountNotPositive: string;
    giveItAName: string;
    nameRequired: string;
    invalidEmail: string;
    passwordMinLength: string;
    passwordMaxLength: string;
    passwordRequired: string;
    currentPasswordRequired: string;
    newPasswordMinLength: string;
    newPasswordMaxLength: string;
    amountTooLarge: string;
    dueDayRequiredForMonthly: string;
  };
};
