/*
 * High Risk Wars v2 — Drug Wars-inspired 30-day merchant survival
 */

(() => {
  const MAX_DAYS = 30;
  const MAX_ACTIONS_PER_DAY = 3;
  const MAX_DEBT_LIMIT = 75000;
  const MAX_SHUTDOWN_DAYS = 4;
  const SAVE_KEY = 'highriskwars_save_v2';
  const INVENTORY_UNIT_VALUE = 80;
  const SOVEREIGN_STACK_URL = 'https://sovereignstack.pro';

  const PRODUCTS = {
    sovpay: {
      id: 'sovpay',
      name: 'SovPay',
      cost: 7500,
      url: 'https://sovpay.me',
      blurb: 'Fallback wallet — keeps revenue flowing when cards fail.',
      promo:
        'SovPay kept your money moving when your processor dropped you. Same idea in real life: a simple fallback payment wallet for merchants who cannot afford to go dark.'
    },
    sovsats: {
      id: 'sovsats',
      name: 'SovSats',
      cost: 10000,
      url: 'https://sovpay.me',
      blurb: 'Bitcoin checkout — less chargeback exposure on a slice of sales.',
      promo:
        'SovSats softened the chargeback hit because not every sale depended on cards. Real-world resilient checkout starts with payment options that do not collapse under chargeback pressure.'
    },
    altpay: {
      id: 'altpay',
      name: 'AltPay Nexus',
      cost: 18000,
      url: SOVEREIGN_STACK_URL,
      blurb: 'Second processor slot — routes sales when primary dies.',
      promo:
        'AltPay Nexus routed payments around the failure. That is the whole point: do not let one processor decide whether your business breathes.'
    },
    railSetup: {
      id: 'railSetup',
      name: 'High-Risk Rail Setup',
      cost: 12000,
      url: SOVEREIGN_STACK_URL,
      blurb: 'Better approvals, softer reserve holds, fewer surprise rejections.',
      promo:
        'Better rail setup helped you survive review. In real life, high-risk merchants need rails designed around their risk profile, not generic checkout.'
    },
    audit: {
      id: 'audit',
      name: 'Checkout Resilience Audit',
      cost: 6000,
      url: SOVEREIGN_STACK_URL,
      blurb: 'Forecasts hidden risks for the next few days.',
      promo:
        'The audit gave you time to act before the failure hit. That is what checkout resilience is: finding weak points before they become lost revenue.'
    },
    fallbackStorefront: {
      id: 'fallbackStorefront',
      name: 'Fallback Storefront',
      cost: 22000,
      url: SOVEREIGN_STACK_URL,
      blurb: 'Backup storefront when main checkout or platform freezes.',
      promo:
        'Your fallback storefront kept the business alive while the main system was frozen. Real operators do not depend on one front door.'
    }
  };

  const START_PACKAGES = [
    {
      id: 'bootstrap',
      name: 'Bootstrap Merchant',
      cash: 6000,
      debt: 0,
      inventory: 25,
      reputation: 42,
      risk: 48,
      compliance: 42,
      chargebackRate: 9,
      demand: 48,
      overhead: 120,
      scoreMultiplier: 1.5,
      backupRail: false,
      description: 'Low cash, no backup rails, higher risk — bigger score if you survive.'
    },
    {
      id: 'scrappy',
      name: 'Scrappy Operator',
      cash: 16000,
      debt: 0,
      inventory: 45,
      reputation: 52,
      risk: 36,
      compliance: 56,
      chargebackRate: 7,
      demand: 56,
      overhead: 180,
      scoreMultiplier: 1.2,
      backupRail: false,
      description: 'Medium cash, small inventory, balanced difficulty.'
    },
    {
      id: 'funded',
      name: 'Funded Brand',
      cash: 45000,
      debt: 0,
      inventory: 70,
      reputation: 68,
      risk: 28,
      compliance: 62,
      chargebackRate: 5,
      demand: 62,
      overhead: 450,
      scoreMultiplier: 1.0,
      backupRail: false,
      description: 'Higher cash and reputation, but brutal fixed costs.'
    },
    {
      id: 'veteran',
      name: 'High-Risk Veteran',
      cash: 22000,
      debt: 28000,
      inventory: 55,
      reputation: 54,
      risk: 58,
      compliance: 48,
      chargebackRate: 11,
      demand: 52,
      overhead: 280,
      scoreMultiplier: 1.35,
      backupRail: true,
      description: 'Starts in debt with a backup rail. Volatile but powerful.'
    }
  ];

  const MARKETS = ['Quiet', 'Normal', 'Hot', 'Volatile', 'Bearish'];

  let gameState = null;
  let pendingPromos = [];
  let activityLog = [];

  function defaultState() {
    return {
      started: false,
      day: 1,
      cash: 0,
      debt: 0,
      inventory: 0,
      totalRevenue: 0,
      reputation: 50,
      risk: 30,
      chargebackRate: 5,
      compliance: 50,
      demand: 50,
      frozenReserves: 0,
      overhead: 0,
      market: 'Normal',
      unitPrice: 100,
      packageId: null,
      scoreMultiplier: 1,
      startingNetWorth: 0,
      actionsLeft: MAX_ACTIONS_PER_DAY,
      primaryActive: true,
      backupActive: false,
      shutdownDays: 0,
      sovpayFlowDays: 0,
      sovpayFlowPct: 0,
      storeFrozen: false,
      platformFrozen: false,
      shutdownsSurvived: 0,
      chargebackStormsSurvived: 0,
      owned: {
        sovpay: false,
        sovsats: false,
        altpay: false,
        railSetup: false,
        audit: false,
        fallbackStorefront: false
      },
      auditDaysLeft: 0,
      auditHint: '',
      promoShown: {},
      gameOver: false,
      won: false,
      endReason: '',
      flashBg: null,
      flashBgUntil: 0
    };
  }

  function netWorth() {
    if (!gameState) return 0;
    return (
      gameState.cash +
      gameState.inventory * INVENTORY_UNIT_VALUE -
      gameState.debt -
      gameState.frozenReserves
    );
  }

  function activeRailCount() {
    let n = 0;
    if (gameState.primaryActive) n += 1;
    if (gameState.backupActive) n += 1;
    if (gameState.owned.sovpay) n += 1;
    if (gameState.owned.sovsats) n += 1;
    return n;
  }

  function hasAnyPaymentPath() {
    if (gameState.primaryActive || gameState.backupActive) return true;
    if (gameState.owned.sovpay && gameState.sovpayFlowDays > 0) return true;
    if (gameState.owned.sovpay) return true;
    if (gameState.owned.sovsats) return true;
    return false;
  }

  function fmt(n) {
    return Math.round(n).toLocaleString();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function addLog(msg, tone = '') {
    activityLog.unshift({ day: gameState.day, msg, tone });
    if (activityLog.length > 40) activityLog.length = 40;
    renderActivityLog();
  }

  function queuePromo(productId) {
    if (gameState.promoShown[productId]) return;
    gameState.promoShown[productId] = true;
    pendingPromos.push(productId);
  }

  function setBackground(mode) {
    document.body.setAttribute('data-bg', mode);
  }

  function updateBackgroundMood() {
    if (gameState.flashBg && Date.now() < gameState.flashBgUntil) {
      setBackground(gameState.flashBg);
      return;
    }
    if (gameState.gameOver) {
      setBackground(gameState.won ? 'millionaire' : 'system-failure');
      return;
    }
    if (gameState.risk >= 75 || gameState.shutdownDays > 0 || gameState.storeFrozen) {
      setBackground('system-failure');
      return;
    }
    if (gameState.market === 'Hot' || gameState.cash > gameState.startingNetWorth * 1.5) {
      setBackground('futuristic');
      return;
    }
    setBackground('war-room');
  }

  function flashBackground(mode, ms = 2500) {
    gameState.flashBg = mode;
    gameState.flashBgUntil = Date.now() + ms;
    updateBackgroundMood();
    setTimeout(updateBackgroundMood, ms + 50);
  }

  function applyPackage(pack) {
    gameState = defaultState();
    gameState.started = true;
    gameState.packageId = pack.id;
    gameState.cash = pack.cash;
    gameState.debt = pack.debt;
    gameState.inventory = pack.inventory;
    gameState.reputation = pack.reputation;
    gameState.risk = pack.risk;
    gameState.compliance = pack.compliance;
    gameState.chargebackRate = pack.chargebackRate;
    gameState.demand = pack.demand;
    gameState.overhead = pack.overhead;
    gameState.scoreMultiplier = pack.scoreMultiplier;
    gameState.backupActive = pack.backupRail;
    if (pack.backupRail) gameState.owned.altpay = true;
    gameState.startingNetWorth = netWorth();
    gameState.market = pick(MARKETS);
    rollUnitPrice();
    activityLog = [];
    pendingPromos = [];
    addLog(`Started as ${pack.name}. Survive 30 days.`, 'good');
    document.getElementById('start-overlay').style.display = 'none';
    saveGame();
    renderAll();
  }

  function rollUnitPrice() {
    const mult = {
      Quiet: 0.85,
      Normal: 1,
      Hot: 1.25,
      Volatile: rand(80, 140) / 100,
      Bearish: 0.75
    };
    gameState.unitPrice = Math.round(100 * (mult[gameState.market] || 1));
  }

  function spend(cost) {
    if (gameState.cash >= cost) {
      gameState.cash -= cost;
      return true;
    }
    const shortfall = cost - gameState.cash;
    if (gameState.debt + shortfall <= MAX_DEBT_LIMIT) {
      gameState.cash = 0;
      gameState.debt += shortfall;
      addLog(`Borrowed $${fmt(shortfall)} to cover costs.`, 'warn');
      return true;
    }
    return false;
  }

  const ACTIONS = [
    {
      id: 'source',
      label: 'Source Inventory',
      cost: () => 4000 + rand(0, 1500),
      desc: () => '+30–50 units',
      run: () => {
        const cost = 4000 + rand(0, 1500);
        if (!spend(cost)) {
          addLog('Cannot afford inventory — debt limit hit.', 'bad');
          return false;
        }
        const units = rand(30, 50);
        gameState.inventory += units;
        gameState.risk = clamp(gameState.risk + 2, 0, 100);
        addLog(`Sourced ${units} units for $${fmt(cost)}.`, 'good');
        return true;
      }
    },
    {
      id: 'ads',
      label: 'Run Ads',
      cost: () => 2500,
      desc: () => 'Boost demand, raise risk',
      run: () => {
        const cost = 2500;
        if (!spend(cost)) {
          addLog('Cannot afford ads.', 'bad');
          return false;
        }
        gameState.demand = clamp(gameState.demand + rand(8, 18), 0, 100);
        gameState.risk = clamp(gameState.risk + rand(3, 8), 0, 100);
        gameState.chargebackRate = clamp(gameState.chargebackRate + 1, 0, 40);
        addLog(`Ads running. Demand up to ${gameState.demand}%.`, 'warn');
        return true;
      }
    },
    {
      id: 'compliance',
      label: 'Lower Risk / Compliance Work',
      cost: () => 3500,
      desc: () => '-risk, +compliance',
      run: () => {
        const cost = 3500;
        if (!spend(cost)) {
          addLog('Cannot afford compliance work.', 'bad');
          return false;
        }
        gameState.risk = clamp(gameState.risk - rand(6, 12), 0, 100);
        gameState.compliance = clamp(gameState.compliance + rand(5, 10), 0, 100);
        gameState.chargebackRate = clamp(gameState.chargebackRate - 1, 0, 40);
        addLog('Compliance work done. Risk cooling off.', 'good');
        return true;
      }
    },
    {
      id: 'payDebt',
      label: 'Pay Debt',
      cost: () => 0,
      desc: () => 'Pay $5,000 toward debt',
      run: () => {
        const payment = Math.min(5000, gameState.debt, gameState.cash);
        if (payment <= 0) {
          addLog('No debt to pay or no cash available.', 'warn');
          return false;
        }
        gameState.cash -= payment;
        gameState.debt -= payment;
        addLog(`Paid $${fmt(payment)} toward debt.`, 'good');
        return true;
      }
    },
    {
      id: 'powerup',
      label: 'Buy Protection / Power-Up',
      cost: () => 0,
      desc: () => 'Open protection shop',
      run: () => {
        showPowerUpShop();
        return false;
      }
    },
    {
      id: 'nextDay',
      label: 'Next Day →',
      cost: () => 0,
      desc: () => 'Resolve sales, costs, and events',
      primary: true,
      run: () => {
        processNextDay();
        return false;
      }
    }
  ];

  function useAction(action) {
    if (gameState.gameOver) return;
    if (action.id !== 'nextDay' && action.id !== 'powerup' && gameState.actionsLeft <= 0) return;

    const result = action.run();

    if (action.id === 'nextDay' || action.id === 'powerup') {
      if (action.id === 'nextDay') {
        saveGame();
        renderAll();
        processPromoQueue();
      }
      return;
    }

    if (result !== false) {
      gameState.actionsLeft = Math.max(0, gameState.actionsLeft - 1);
    }
    saveGame();
    renderAll();
    processPromoQueue();
  }

  function showPowerUpShop() {
    const available = Object.values(PRODUCTS).filter((p) => !gameState.owned[p.id]);
    if (!available.length) {
      addLog('You already own every protection product.', 'warn');
      renderAll();
      return;
    }
    showModal(
      'Protection Shop',
      'Buy resilience before the rails catch fire. Each product helps in specific failure scenarios.',
      available.map((p) => ({
        label: `${p.name} — $${fmt(p.cost)}\n${p.blurb}`,
        action: () => {
          if (gameState.owned[p.id]) return;
          if (!spend(p.cost)) {
            addLog(`Cannot afford ${p.name}.`, 'bad');
            return;
          }
          gameState.owned[p.id] = true;
          if (p.id === 'altpay') gameState.backupActive = true;
          if (p.id === 'sovpay') addLog('SovPay wallet live — non-card rail ready.', 'good');
          if (p.id === 'sovsats') addLog('SovSats enabled — partial Bitcoin checkout.', 'good');
          if (p.id === 'audit') {
            gameState.auditDaysLeft = rand(3, 5);
            gameState.auditHint = generateAuditHint();
            addLog(`Audit complete: ${gameState.auditHint}`, 'warn');
          }
          if (p.id === 'fallbackStorefront') addLog('Fallback storefront deployed.', 'good');
          if (p.id === 'railSetup') addLog('High-risk rail setup applied.', 'good');
          gameState.actionsLeft = Math.max(0, gameState.actionsLeft - 1);
          flashBackground('millionaire');
          saveGame();
          renderAll();
        }
      })).concat([{ label: 'Cancel', action: () => {} }])
    );
  }

  function generateAuditHint() {
    const hints = [
      'Processor review likely in 2–3 days.',
      'Chargebacks rising — tighten refunds.',
      'Reserve hold possible soon.',
      'Ad account at risk if demand spikes.',
      'Fraud wave incoming — watch inventory.'
    ];
    return pick(hints);
  }

  function processNextDay() {
    if (gameState.day >= MAX_DAYS) {
      checkWinLoss(true);
      return;
    }

    gameState.day += 1;
    gameState.actionsLeft = MAX_ACTIONS_PER_DAY;
    gameState.market = pick(MARKETS);
    rollUnitPrice();

    if (Math.random() < 0.35) gameState.demand = clamp(gameState.demand + rand(-10, 12), 20, 100);

    const salesResult = resolveSales();
    applyDailyCosts(salesResult);
    applyChargebacks(salesResult.cardRevenue);

    if (gameState.auditDaysLeft > 0) {
      gameState.auditDaysLeft -= 1;
      gameState.risk = clamp(gameState.risk - 2, 0, 100);
    }

    gameState.compliance = clamp(gameState.compliance - rand(0, 2), 0, 100);
    if (gameState.compliance < 40) gameState.risk = clamp(gameState.risk + 2, 0, 100);

    if (gameState.shutdownDays > 0) {
      gameState.shutdownDays += 1;
      if (gameState.sovpayFlowDays > 0) gameState.sovpayFlowDays -= 1;
    }

    if (gameState.sovpayFlowDays <= 0 && gameState.shutdownDays > 0 && !gameState.primaryActive && !gameState.backupActive) {
      if (!gameState.owned.sovpay && !gameState.owned.sovsats) {
        gameState.shutdownDays += 1;
      }
    }

    maybeTriggerEvent();

    if (gameState.day >= MAX_DAYS) checkWinLoss(true);
    else checkWinLoss(false);

    saveGame();
    renderAll();
    processPromoQueue();
  }

  function resolveSales() {
    let capacity = Math.floor((gameState.demand / 100) * 15) + 5;
    if (gameState.storeFrozen && gameState.owned.fallbackStorefront) {
      capacity = Math.floor(capacity * (rand(40, 70) / 100));
      addLog('Fallback storefront absorbing frozen-main-store traffic.', 'warn');
    } else if (gameState.storeFrozen) {
      capacity = Math.floor(capacity * 0.3);
      addLog('Main store frozen — sales crippled.', 'bad');
    }

    let units = Math.min(gameState.inventory, capacity);
    let gross = units * gameState.unitPrice;
    gameState.inventory -= units;

    let cardRevenue = gross;
    let nonCardPct = 0;

    if (gameState.owned.sovsats) {
      nonCardPct = 0.25 + (gameState.reputation > 60 ? 0.1 : 0);
      if (gameState.reputation < 45) gross = Math.floor(gross * 0.92);
    }

    let collected = gross;

    if (!gameState.primaryActive) {
      let recovery = 0;
      if (gameState.sovpayFlowDays > 0 && gameState.owned.sovpay) {
        recovery = Math.floor(gross * gameState.sovpayFlowPct);
        addLog(`SovPay kept ${Math.round(gameState.sovpayFlowPct * 100)}% flowing ($${fmt(recovery)}).`, 'good');
      }
      if (gameState.backupActive && gameState.owned.altpay) {
        const alt = Math.floor(gross * rand(35, 55) / 100);
        recovery = Math.max(recovery, alt);
        addLog(`AltPay Nexus routed $${fmt(alt)} around the outage.`, 'good');
      }
      if (gameState.owned.sovpay && recovery > 0) {
        gameState.shutdownsSurvived += 1;
        queuePromo('sovpay');
      }
      if (gameState.owned.altpay && gameState.backupActive && recovery > 0 && !gameState.primaryActive) {
        queuePromo('altpay');
      }
      collected = recovery;
      cardRevenue = Math.floor(recovery * (1 - nonCardPct));
    } else {
      cardRevenue = Math.floor(gross * (1 - nonCardPct));
    }

    if (gameState.platformFrozen && gameState.owned.fallbackStorefront) {
      const fb = Math.floor(gross * rand(40, 70) / 100);
      collected = Math.max(collected, fb);
      addLog(`Fallback storefront saved $${fmt(fb)} during platform freeze.`, 'good');
      queuePromo('fallbackStorefront');
    }

    gameState.cash += collected;
    gameState.totalRevenue += collected;
    gameState.reputation = clamp(gameState.reputation + (collected > 3000 ? 1 : 0), 0, 100);

    if (collected > 5000) flashBackground('millionaire');
    else if (gameState.market === 'Hot') flashBackground('futuristic');

    addLog(
      `Day ${gameState.day}: Sold ${units} units (${gameState.market} market) for $${fmt(collected)}.`,
      collected > 0 ? 'good' : 'bad'
    );

    return { gross, cardRevenue, collected };
  }

  function applyDailyCosts(salesResult) {
    if (!spend(gameState.overhead)) {
      addLog(`Could not cover $${fmt(gameState.overhead)} daily overhead.`, 'bad');
    } else {
      addLog(`Overhead: $${fmt(gameState.overhead)}.`);
    }

    if (gameState.debt > 0) {
      const interest = Math.floor(gameState.debt * 0.008);
      gameState.debt += interest;
      addLog(`Debt interest: $${fmt(interest)}.`, 'warn');
    }

    if (gameState.frozenReserves > 0 && Math.random() < 0.25) {
      const release = Math.min(gameState.frozenReserves, rand(500, 3000));
      gameState.frozenReserves -= release;
      gameState.cash += release;
      addLog(`Reserve release: $${fmt(release)}.`, 'good');
    }
  }

  function applyChargebacks(cardRevenue) {
    if (cardRevenue <= 0) return;
    let rate = gameState.chargebackRate / 100;
    if (gameState.owned.sovsats) rate *= 0.55;
    const cbAmount = Math.floor(cardRevenue * rate * rand(8, 18) / 100);
    if (cbAmount <= 0) return;

    let finalCb = cbAmount;
    let saved = 0;
    if (gameState.owned.sovsats) {
      saved = Math.floor(cbAmount * 0.4);
      finalCb = cbAmount - saved;
      if (saved > 0) queuePromo('sovsats');
    }

    gameState.cash -= finalCb;
    gameState.risk = clamp(gameState.risk + Math.floor(finalCb / 500), 0, 100);
    addLog(`Chargebacks hit: $${fmt(finalCb)}.${saved ? ` SovSats absorbed $${fmt(saved)}.` : ''}`, 'bad');
  }

  function triggerProcessorShutdown() {
    const wasActive = gameState.primaryActive;
    gameState.primaryActive = false;
    gameState.shutdownDays = 1;
    if (wasActive) {
      addLog('Processor shutdown — card rail is DOWN.', 'bad');
      if (gameState.owned.sovpay) {
        gameState.sovpayFlowDays = rand(1, 3);
        gameState.sovpayFlowPct = rand(60, 85) / 100;
      }
      if (gameState.owned.altpay && gameState.backupActive) {
        addLog('AltPay backup rail engaging...', 'warn');
      }
    }
    setBackground('system-failure');
  }

  function maybeTriggerEvent() {
    const roll = Math.random();
    const threshold = 0.28 + gameState.risk / 200;
    if (roll > threshold) return;

    const event = pick(EVENTS);
    event.run();
  }

  const EVENTS = [
    {
      id: 'processorShutdown',
      run: () => {
        maybeAuditPromo('processor');
        showModal(
          'Processor Shutdown',
          "Your processor read the room, panicked, and decided your perfectly legal store is now 'too spicy.' Payouts are paused.",
          [
            {
              label: 'Appeal (50/50)',
              action: () => {
                if (Math.random() > 0.5) {
                  gameState.primaryActive = true;
                  gameState.shutdownDays = 0;
                  addLog('Appeal won — processor reinstated!', 'good');
                } else {
                  triggerProcessorShutdown();
                }
              }
            },
            {
              label: 'Switch to backup rails',
              action: () => {
                if (gameState.owned.altpay) {
                  gameState.backupActive = true;
                  addLog('AltPay absorbing traffic.', 'good');
                } else {
                  triggerProcessorShutdown();
                }
              }
            },
            { label: 'Accept fate', action: () => triggerProcessorShutdown() }
          ]
        );
      }
    },
    {
      id: 'chargebackStorm',
      run: () => {
        maybeAuditPromo('chargeback');
        const stormDamage = rand(3000, 12000);
        showModal(
          'Chargeback Storm',
          'Chargebacks exploded overnight. Dispute inbox looks like a horror movie franchise.',
          [
            {
              label: 'Fight disputes ($4k)',
              action: () => {
                if (spend(4000)) {
                  const reduced = Math.floor(stormDamage * 0.4);
                  gameState.cash -= reduced;
                  gameState.chargebackRate = clamp(gameState.chargebackRate - 2, 0, 40);
                  gameState.chargebackStormsSurvived += 1;
                  if (gameState.owned.sovsats && reduced < stormDamage) queuePromo('sovsats');
                  addLog(`Dispute fight limited damage to $${fmt(reduced)}.`, 'warn');
                }
              }
            },
            {
              label: 'Eat it',
              action: () => {
                let dmg = stormDamage;
                if (gameState.owned.sovsats) {
                  const saved = Math.floor(dmg * 0.35);
                  dmg -= saved;
                  queuePromo('sovsats');
                }
                gameState.cash -= dmg;
                gameState.chargebackRate = clamp(gameState.chargebackRate + 4, 0, 40);
                gameState.risk = clamp(gameState.risk + 8, 0, 100);
                gameState.chargebackStormsSurvived += 1;
                addLog(`Chargeback storm cost $${fmt(dmg)}.`, 'bad');
              }
            }
          ]
        );
      }
    },
    {
      id: 'bankReview',
      run: () => {
        maybeAuditPromo('review');
        showModal(
          'Bank Review',
          'Your bank wants "a few documents." Translation: prove you are not a cartoon villain.',
          [
            {
              label: 'Submit docs',
              action: () => {
                const pass = gameState.compliance >= 50 || gameState.owned.railSetup;
                if (pass) {
                  addLog('Bank review passed.', 'good');
                  if (gameState.owned.railSetup) queuePromo('railSetup');
                } else {
                  const seize = Math.floor(gameState.cash * 0.3);
                  gameState.cash -= seize;
                  gameState.frozenReserves += seize;
                  addLog(`Review failed — $${fmt(seize)} moved to reserves.`, 'bad');
                }
              }
            },
            {
              label: 'Stall',
              action: () => {
                gameState.risk = clamp(gameState.risk + 10, 0, 100);
                addLog('Stalling made the bank suspicious.', 'warn');
              }
            }
          ]
        );
      }
    },
    {
      id: 'reserveHold',
      run: () => {
        let hold = rand(2000, 8000);
        if (gameState.owned.railSetup) hold = Math.floor(hold * 0.5);
        gameState.frozenReserves += hold;
        gameState.cash = Math.max(0, gameState.cash - hold);
        if (gameState.owned.railSetup) queuePromo('railSetup');
        showModal(
          'Reserve Hold',
          `Processor grabbed $${fmt(hold)} in rolling reserves. Your cash flow just got a personality test.`,
          [{ label: 'Grind through it', action: () => addLog('Reserve hold active.', 'warn') }]
        );
      }
    },
    {
      id: 'adBan',
      run: () => {
        gameState.demand = clamp(gameState.demand - rand(10, 20), 10, 100);
        showModal(
          'Ad Account Banned',
          'FaceSpace banned your ad account for "policy reasons." Their policy is apparently vibes-based.',
          [
            {
              label: 'Diversify ($3k)',
              action: () => {
                if (spend(3000)) gameState.demand = clamp(gameState.demand + 8, 0, 100);
              }
            },
            { label: 'Wait it out', action: () => addLog('Demand dropped after ad ban.', 'bad') }
          ]
        );
      }
    },
    {
      id: 'supplierDelay',
      run: () => {
        const lost = rand(5, 20);
        gameState.inventory = Math.max(0, gameState.inventory - lost);
        showModal(
          'Supplier Delay',
          'Supplier ghosted you. Shipment stuck somewhere between overseas and "we will call you back."',
          [{ label: 'Source emergency stock ($5k)', action: () => spend(5000) && (gameState.inventory += 25) }]
        );
      }
    },
    {
      id: 'fraudWave',
      run: () => {
        gameState.risk = clamp(gameState.risk + rand(5, 12), 0, 100);
        const loss = rand(1500, 5000);
        gameState.cash -= loss;
        showModal(
          'Fraud Wave',
          'Fraudsters discovered your checkout. They are not buying — they are stress-testing your sanity.',
          [{ label: 'Tighten checks ($2k)', action: () => spend(2000) && (gameState.risk -= 8) }]
        );
      }
    },
    {
      id: 'viralSpike',
      run: () => {
        gameState.demand = clamp(gameState.demand + rand(15, 30), 0, 100);
        gameState.risk = clamp(gameState.risk + rand(5, 10), 0, 100);
        showModal(
          'Viral Sales Spike',
          'A viral clip sent traffic nuclear. Great for revenue. Terrible for processor nerves.',
          [
            { label: 'Ramp inventory ($6k)', action: () => spend(6000) && (gameState.inventory += 40) },
            { label: 'Ride the wave', action: () => addLog('Riding viral demand — risk climbing.', 'warn') }
          ]
        );
      }
    },
    {
      id: 'influencer',
      run: () => {
        gameState.reputation = clamp(gameState.reputation + rand(5, 12), 0, 100);
        gameState.demand = clamp(gameState.demand + rand(5, 15), 0, 100);
        showModal(
          'Influencer Mention',
          'An influencer shouted you out. Their audience is hungry and mildly irresponsible with credit cards.',
          [{ label: 'Capitalize', action: () => addLog('Reputation and demand boosted.', 'good') }]
        );
      }
    },
    {
      id: 'complianceWarning',
      run: () => {
        showModal(
          'Compliance Warning',
          'Regulatory letter arrived. It uses the word "immediately" three times.',
          [
            {
              label: 'Compliance sprint ($4k)',
              action: () => spend(4000) && (gameState.compliance += 12) && (gameState.risk -= 6)
            },
            { label: 'Ignore', action: () => (gameState.risk += 12) }
          ]
        );
      }
    },
    {
      id: 'refundWave',
      run: () => {
        const refunds = rand(2000, 6000);
        gameState.cash -= refunds;
        gameState.chargebackRate = clamp(gameState.chargebackRate + 2, 0, 40);
        showModal(
          'Refund Wave',
          'Customers want refunds. Apparently "high risk" includes buyer remorse at scale.',
          [{ label: 'Improve policy ($3k)', action: () => spend(3000) && (gameState.chargebackRate -= 3) }]
        );
      }
    },
    {
      id: 'platformFreeze',
      run: () => {
        gameState.platformFrozen = true;
        showModal(
          'Platform Freeze',
          'Your main storefront platform froze checkout. The spinner of doom is now your business partner.',
          [
            {
              label: 'Deploy fallback',
              action: () => {
                if (gameState.owned.fallbackStorefront) {
                  addLog('Fallback storefront online.', 'good');
                } else {
                  gameState.storeFrozen = true;
                  addLog('No fallback — store effectively frozen.', 'bad');
                }
              }
            }
          ]
        );
        setTimeout(() => {
          gameState.platformFrozen = false;
          gameState.storeFrozen = false;
        }, 0);
      }
    },
    {
      id: 'whaleOrder',
      run: () => {
        const bonus = rand(8000, 20000);
        showModal(
          'Friendly Whale Order',
          'A whale placed a huge order. Either a blessing or a chargeback trap in a trench coat.',
          [
            {
              label: 'Fulfill it',
              action: () => {
                gameState.cash += bonus;
                gameState.totalRevenue += bonus;
                gameState.risk = clamp(gameState.risk + 5, 0, 100);
                flashBackground('millionaire');
                addLog(`Whale order paid $${fmt(bonus)}!`, 'good');
              }
            },
            { label: 'Decline (safer)', action: () => addLog('Declined whale order — risk avoided.') }
          ]
        );
      }
    },
    {
      id: 'shippingIssue',
      run: () => {
        gameState.reputation = clamp(gameState.reputation - rand(3, 8), 0, 100);
        showModal(
          'Shipping Issue',
          'Carrier lost a batch. Customers are tweeting. Your reputation is not.',
          [{ label: 'Refund & reship ($4k)', action: () => spend(4000) && (gameState.reputation += 5) }]
        );
      }
    },
    {
      id: 'gatewayOutage',
      run: () => {
        if (!gameState.primaryActive) triggerProcessorShutdown();
        else {
          gameState.primaryActive = false;
          gameState.shutdownDays = 1;
        }
        showModal(
          'Payment Gateway Outage',
          'Gateway went dark mid-checkout. Customers bounced faster than your reserve ratio.',
          [{ label: 'Emergency failover', action: () => gameState.owned.altpay && (gameState.backupActive = true) }]
        );
      }
    },
    {
      id: 'competitorCollapse',
      run: () => {
        gameState.demand = clamp(gameState.demand + rand(8, 18), 0, 100);
        showModal(
          'Competitor Collapse',
          'A competitor imploded. Their customers are shopping around like it is Black Friday for chaos.',
          [{ label: 'Capture market share', action: () => addLog('Demand surged from competitor collapse.', 'good') }]
        );
      }
    }
  ];

  function maybeAuditPromo(keyword) {
    if (gameState.auditDaysLeft > 0 && gameState.auditHint.toLowerCase().includes(keyword)) {
      queuePromo('audit');
      addLog('Your audit warned you — time well spent.', 'good');
    }
  }

  function checkWinLoss(endOfRun) {
    if (gameState.gameOver) return;

    if (gameState.cash < 0 && gameState.debt >= MAX_DEBT_LIMIT) {
      endGame(false, 'Cash collapsed and you maxed out debt. Game over.');
      return;
    }
    if (gameState.debt > MAX_DEBT_LIMIT) {
      endGame(false, 'Debt exceeded the limit. Loan shark energy defeated you.');
      return;
    }
    if (gameState.risk >= 100) {
      endGame(false, 'Risk hit 100. Banks, processors, and karma united against you.');
      return;
    }
    if (!hasAnyPaymentPath() && gameState.shutdownDays >= MAX_SHUTDOWN_DAYS) {
      endGame(false, 'All payment rails dead with no fallback. You cannot get paid.');
      return;
    }
    if (gameState.shutdownDays >= MAX_SHUTDOWN_DAYS && !gameState.owned.sovpay && !gameState.owned.sovsats && !gameState.backupActive) {
      endGame(false, 'Processor shutdown outlasted your options. Revenue flatlined.');
      return;
    }

    if (endOfRun && gameState.day >= MAX_DAYS) {
      const nw = netWorth();
      const rails = activeRailCount();
      if (gameState.cash > 0 && rails >= 1 && nw > gameState.startingNetWorth) {
        endGame(true, `You survived 30 days with $${fmt(nw)} net worth and ${rails} rail(s) active.`);
      } else {
        const reasons = [];
        if (gameState.cash <= 0) reasons.push('cash not positive');
        if (rails < 1) reasons.push('no active payment rails');
        if (nw <= gameState.startingNetWorth) reasons.push('net worth did not beat your start');
        endGame(false, `Day 30 reached but you did not meet win conditions: ${reasons.join(', ')}.`);
      }
    }
  }

  function calculateScore() {
    const nw = netWorth();
    let score = nw / 100;
    score += gameState.day * 50;
    score += gameState.totalRevenue / 500;
    score += gameState.shutdownsSurvived * 200;
    score += gameState.chargebackStormsSurvived * 150;
    score += activeRailCount() * 100;
    score -= gameState.debt / 200;
    score -= gameState.risk * 5;
    score = Math.max(0, Math.floor(score * gameState.scoreMultiplier));
    return score;
  }

  function endGame(won, reason) {
    gameState.gameOver = true;
    gameState.won = won;
    gameState.endReason = reason;
    const score = calculateScore();
    const rails = activeRailCount();
    const share = `I survived ${gameState.day} days in High Risk Wars with $${fmt(netWorth())} net worth, ${rails} rails active, and ${gameState.shutdownsSurvived} shutdowns survived. Score: ${score}`;

    const overlay = document.getElementById('end-overlay');
    const panel = document.getElementById('end-modal');
    panel.classList.toggle('win', won);
    panel.classList.toggle('lose', !won);
    document.getElementById('end-title').textContent = won ? 'You Survived!' : 'Game Over';
    document.getElementById('end-summary').textContent = reason;
    document.getElementById('end-score').textContent = fmt(score);
    document.getElementById('share-text').textContent = share;
    overlay.classList.add('active');
    updateBackgroundMood();
    saveGame();
  }

  function showModal(title, description, choices) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-description').textContent = description;
    const choicesEl = document.getElementById('modal-choices');
    choicesEl.innerHTML = '';
    choices.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-button';
      btn.textContent = c.label;
      btn.addEventListener('click', () => {
        c.action();
        overlay.classList.remove('active');
        saveGame();
        renderAll();
        processPromoQueue();
      });
      choicesEl.appendChild(btn);
    });
    overlay.classList.add('active');
  }

  function processPromoQueue() {
    if (!pendingPromos.length || gameState.gameOver) return;
    const id = pendingPromos.shift();
    const product = PRODUCTS[id];
    if (!product) return;

    const overlay = document.getElementById('promo-overlay');
    document.getElementById('promo-title').textContent = product.name;
    document.getElementById('promo-description').textContent = product.promo;
    document.getElementById('promo-learn').onclick = () => {
      window.open(product.url, '_blank', 'noopener');
      overlay.classList.remove('active');
      processPromoQueue();
    };
    document.getElementById('promo-dismiss').onclick = () => {
      overlay.classList.remove('active');
      processPromoQueue();
    };
    overlay.classList.add('active');
  }

  function renderActionButtons() {
    const container = document.getElementById('action-buttons');
    container.innerHTML = '';
    ACTIONS.forEach((action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'action-button' + (action.primary ? ' primary-action' : '');
      const cost = action.cost();
      const disabled =
        gameState.gameOver ||
        (action.id !== 'nextDay' && action.id !== 'powerup' && gameState.actionsLeft <= 0);
      btn.disabled = disabled;
      btn.innerHTML = `<strong>${action.label}</strong><span class="action-cost">${
        cost > 0 ? `$${fmt(cost)} · ` : ''
      }${action.desc()}</span>`;
      btn.addEventListener('click', () => useAction(action));
      container.appendChild(btn);
    });
  }

  function renderStats() {
    document.getElementById('stat-day').textContent = gameState.day;
    document.getElementById('stat-cash').textContent = fmt(gameState.cash);
    document.getElementById('market-condition').textContent = `Market: ${gameState.market} · $${gameState.unitPrice}/unit`;
    document.getElementById('actions-remaining').textContent = `Actions: ${gameState.actionsLeft}/${MAX_ACTIONS_PER_DAY}`;

    document.getElementById('risk-value').textContent = `${gameState.risk}%`;
    document.getElementById('risk-bar').style.width = `${gameState.risk}%`;

    const railsEl = document.getElementById('rails-list');
    railsEl.innerHTML = '';
    const rails = [];
    rails.push({
      label: gameState.primaryActive ? 'Primary Processor — LIVE' : 'Primary Processor — DOWN',
      down: !gameState.primaryActive
    });
    if (gameState.owned.altpay || gameState.backupActive) {
      rails.push({
        label: gameState.backupActive ? 'AltPay Nexus — LIVE' : 'AltPay Nexus — standby',
        power: true
      });
    }
    if (gameState.owned.sovpay) {
      rails.push({
        label:
          gameState.sovpayFlowDays > 0
            ? `SovPay — flowing (${gameState.sovpayFlowDays}d left)`
            : 'SovPay — wallet ready',
        power: true
      });
    }
    if (gameState.owned.sovsats) rails.push({ label: 'SovSats — BTC checkout', power: true });
    if (!rails.length) rails.push({ label: 'No rails — you are exposed', down: true });

    rails.forEach((r) => {
      const li = document.createElement('li');
      li.textContent = r.label;
      if (r.down) li.classList.add('down');
      if (r.power) li.classList.add('power');
      railsEl.appendChild(li);
    });

    const stats = [
      { label: 'Debt', value: `$${fmt(gameState.debt)}`, danger: gameState.debt > 20000 },
      { label: 'Inventory', value: gameState.inventory },
      { label: 'Net Worth', value: `$${fmt(netWorth())}` },
      { label: 'Revenue (run)', value: `$${fmt(gameState.totalRevenue)}` },
      { label: 'Reputation', value: `${gameState.reputation}%` },
      { label: 'Demand', value: `${gameState.demand}%` },
      { label: 'Chargeback Rate', value: `${gameState.chargebackRate}%`, danger: gameState.chargebackRate > 15 },
      { label: 'Compliance', value: `${gameState.compliance}%` },
      { label: 'Frozen Reserves', value: `$${fmt(gameState.frozenReserves)}` }
    ];

    const grid = document.getElementById('stats-grid');
    grid.innerHTML = '';
    stats.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'stat-card' + (s.danger ? ' danger' : '');
      card.innerHTML = `<span class="label">${s.label}</span><span class="value">${s.value}</span>`;
      grid.appendChild(card);
    });

    const auditEl = document.getElementById('audit-warnings');
    if (gameState.auditDaysLeft > 0 && gameState.auditHint) {
      auditEl.classList.remove('hidden');
      auditEl.textContent = `Audit (${gameState.auditDaysLeft}d): ${gameState.auditHint}`;
    } else {
      auditEl.classList.add('hidden');
    }

    updateBackgroundMood();
  }

  function renderActivityLog() {
    const el = document.getElementById('activity-log');
    el.innerHTML = '';
    activityLog.forEach((entry) => {
      const li = document.createElement('li');
      li.className = entry.tone;
      li.textContent = `[D${entry.day}] ${entry.msg}`;
      el.appendChild(li);
    });
  }

  function renderAll() {
    if (!gameState || !gameState.started) return;
    renderActionButtons();
    renderStats();
    renderActivityLog();
  }

  function setupStartSelection() {
    const container = document.getElementById('start-options');
    START_PACKAGES.forEach((pack) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'package-btn';
      btn.innerHTML = `<strong>${pack.name}</strong><span>${pack.description}</span>`;
      btn.addEventListener('click', () => applyPackage(pack));
      container.appendChild(btn);
    });
  }

  function saveGame() {
    if (!gameState?.started) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ gameState, activityLog, pendingPromos })
      );
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.gameState?.started) return false;
      gameState = data.gameState;
      activityLog = data.activityLog || [];
      pendingPromos = data.pendingPromos || [];
      document.getElementById('start-overlay').style.display = 'none';
      renderAll();
      if (gameState.gameOver) {
        const score = calculateScore();
        const rails = activeRailCount();
        const share = `I survived ${gameState.day} days in High Risk Wars with $${fmt(netWorth())} net worth, ${rails} rails active, and ${gameState.shutdownsSurvived} shutdowns survived. Score: ${score}`;
        const overlay = document.getElementById('end-overlay');
        const panel = document.getElementById('end-modal');
        panel.classList.toggle('win', gameState.won);
        panel.classList.toggle('lose', !gameState.won);
        document.getElementById('end-title').textContent = gameState.won ? 'You Survived!' : 'Game Over';
        document.getElementById('end-summary').textContent = gameState.endReason || '';
        document.getElementById('end-score').textContent = fmt(score);
        document.getElementById('share-text').textContent = share;
        overlay.classList.add('active');
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function resetGame() {
    localStorage.removeItem(SAVE_KEY);
    gameState = null;
    activityLog = [];
    pendingPromos = [];
    document.getElementById('end-overlay').classList.remove('active');
    document.getElementById('start-overlay').style.display = 'flex';
    setBackground('war-room');
  }

  function startParticleSystem() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const particles = [];
    const colours = ['#00ffff', '#ff00ff', '#ffa500', '#00c896'];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius: Math.random() * 2 + 1,
        color: colours[Math.floor(Math.random() * colours.length)]
      });
    }
    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });
    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        ctx.beginPath();
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4);
        g.addColorStop(0, p.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {});
    }
  }

  document.getElementById('btn-restart').addEventListener('click', resetGame);
  document.getElementById('btn-share').addEventListener('click', () => {
    const text = document.getElementById('share-text').textContent;
    navigator.clipboard?.writeText(text).then(() => addLog('Score copied to clipboard.', 'good'));
  });

  window.addEventListener('DOMContentLoaded', () => {
    setupStartSelection();
    startParticleSystem();
    registerServiceWorker();
    if (!loadGame()) setBackground('war-room');
  });
})();
