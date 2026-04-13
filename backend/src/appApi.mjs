/**
 * Read-API voor de Next.js Orion-webapp (server-side fetch).
 * Authenticatie: HMAC-getekende BFF-headers (ORION_BFF_SECRET) + membership-check.
 */
import express from 'express';
import { getPrisma } from './prisma.mjs';
import { sanitizeErrorForClient } from './security.mjs';
import { resolveBffTenantContext } from './bffAuth.mjs';

const isProd = process.env.NODE_ENV === 'production';

function setAppCors(req, res) {
  const origin = req.headers.origin;
  const allowList = new Set([
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    process.env.CORS_ORIGIN?.trim(),
  ].filter(Boolean));
  if (origin && (allowList.has(origin) || (!isProd && /^http:\/\/localhost:\d+$/.test(origin)))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!isProd) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Orion-User-Id, X-Orion-Tenant-Id, X-Orion-Ts, X-Orion-Signature'
  );
}

function eur(cents) {
  if (cents == null) return '€ 0';
  const n = Number(cents) / 100;
  return `€ ${n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function relTime(iso) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'zojuist';
  if (m < 60) return `${m} min geleden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} u geleden`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d geleden`;
  return new Date(iso).toLocaleDateString('nl-BE');
}

export const appApiRouter = express.Router();

appApiRouter.use((req, res, next) => {
  setAppCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

appApiRouter.use(async (req, res, next) => {
  const prisma = getPrisma();
  if (!prisma) {
    return res.status(503).json({
      error: { code: 'DATABASE_UNCONFIGURED', message: 'Zet DATABASE_URL en voer prisma migrate + seed uit.' },
    });
  }
  try {
    const ctx = await resolveBffTenantContext(req, prisma);
    if (ctx.error) {
      const messages = {
        BFF_SECRET_UNCONFIGURED: 'Zet ORION_BFF_SECRET in backend/.env — zelfde waarde als in apps/orion-web/.env.local.',
        MISSING_BFF_AUTH: 'Ontbrekende BFF-headers (verwacht server-side fetch met handtekening).',
        INVALID_BFF_AUTH: 'Ongeldige BFF-headers.',
        STALE_BFF_AUTH: 'Handtekening verlopen. Vernieuw de pagina.',
        INVALID_BFF_SIGNATURE: 'Ongeldige handtekening.',
        NO_MEMBERSHIP: 'Geen toegang tot deze workspace.',
        TENANT_NOT_FOUND: 'Workspace niet gevonden.',
      };
      return res.status(ctx.status || 401).json({
        error: {
          code: ctx.error,
          message: messages[ctx.error] || 'Authenticatie mislukt.',
        },
      });
    }
    req.orion = {
      prisma: ctx.prisma,
      tenant: ctx.tenant,
      membership: ctx.membership,
      userId: ctx.userId,
      role: ctx.role,
    };
    next();
  } catch (e) {
    console.error(e);
    const { message } = sanitizeErrorForClient(e, 'Databasefout');
    res.status(500).json({ error: { code: 'DB_ERROR', message } });
  }
});

appApiRouter.get('/tenant', (req, res) => {
  const { tenant } = req.orion;
  res.json({
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
  });
});

appApiRouter.get('/projects', async (req, res) => {
  const { prisma, tenant } = req.orion;
  try {
    const projects = await prisma.project.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      include: {
        client: { select: { id: true, companyName: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        startDate: p.startDate,
        deadline: p.deadline,
        progress: p.progress,
        priority: p.priority,
        client: p.client,
        taskCount: p._count.tasks,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: 'QUERY_FAILED', message: 'Kon projecten niet laden.' } });
  }
});

appApiRouter.get('/clients', async (req, res) => {
  const { prisma, tenant } = req.orion;
  try {
    const clients = await prisma.client.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { companyName: 'asc' },
      include: {
        accountManager: { select: { id: true, name: true, email: true } },
        _count: { select: { projects: true, invoices: true } },
      },
    });
    res.json({
      clients: clients.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        contactName: c.contactName,
        email: c.email,
        phone: c.phone,
        city: c.city,
        status: c.status,
        vatNumber: c.vatNumber,
        lastContactAt: c.lastContactAt,
        accountManager: c.accountManager,
        projectCount: c._count.projects,
        invoiceCount: c._count.invoices,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: 'QUERY_FAILED', message: 'Kon klanten niet laden.' } });
  }
});

appApiRouter.get('/tasks', async (req, res) => {
  const { prisma, tenant } = req.orion;
  try {
    const tasks = await prisma.task.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
        client: { select: { id: true, companyName: true } },
      },
    });
    res.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        assignee: t.assignee,
        project: t.project,
        client: t.client,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: 'QUERY_FAILED', message: 'Kon taken niet laden.' } });
  }
});

appApiRouter.get('/meetings', async (req, res) => {
  const { prisma, tenant } = req.orion;
  try {
    const meetings = await prisma.meeting.findMany({
      where: { tenantId: tenant.id },
      orderBy: { startsAt: 'desc' },
      include: {
        client: { select: { id: true, companyName: true } },
        project: { select: { id: true, title: true } },
        _count: { select: { actionItems: true, participants: true } },
      },
      take: 50,
    });
    res.json({
      meetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        summary: m.summary,
        client: m.client,
        project: m.project,
        actionItemCount: m._count.actionItems,
        participantCount: m._count.participants,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: 'QUERY_FAILED', message: 'Kon meetings niet laden.' } });
  }
});

appApiRouter.get('/invoices', async (req, res) => {
  const { prisma, tenant } = req.orion;
  try {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      orderBy: { issueDate: 'desc' },
      include: {
        client: { select: { id: true, companyName: true } },
        project: { select: { id: true, title: true } },
      },
      take: 100,
    });
    res.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountCents: inv.amountCents,
        amountFormatted: eur(inv.amountCents),
        currency: inv.currency,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        client: inv.client,
        project: inv.project,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: 'QUERY_FAILED', message: 'Kon facturen niet laden.' } });
  }
});

appApiRouter.get('/dashboard', async (req, res) => {
  const { prisma, tenant } = req.orion;
  const tid = tenant.id;
  const now = new Date();
  const sod = startOfDay(now);
  const eod = endOfDay(now);
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const in7d = new Date(sod);
  in7d.setDate(in7d.getDate() + 7);

  try {
    const [
      activeClients,
      activeProjects,
      openTasks,
      overdueInvoicesCount,
      sentInvoicesAgg,
      paidThisMonth,
      paidLastMonth,
      prevActiveClients,
    ] = await Promise.all([
      prisma.client.count({ where: { tenantId: tid, deletedAt: null, status: 'ACTIVE' } }),
      prisma.project.count({
        where: {
          tenantId: tid,
          deletedAt: null,
          status: { in: ['PLANNED', 'ACTIVE', 'BLOCKED'] },
        },
      }),
      prisma.task.count({ where: { tenantId: tid, deletedAt: null, status: { not: 'DONE' } } }),
      prisma.invoice.count({
        where: {
          tenantId: tid,
          deletedAt: null,
          OR: [{ status: 'OVERDUE' }, { AND: [{ status: 'SENT' }, { dueDate: { lt: sod } }] }],
        },
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId: tid,
          deletedAt: null,
          status: { in: ['SENT', 'OVERDUE'] },
        },
        _sum: { amountCents: true },
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId: tid,
          deletedAt: null,
          status: 'PAID',
          paidAt: { gte: startThisMonth },
        },
        _sum: { amountCents: true },
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId: tid,
          deletedAt: null,
          status: 'PAID',
          paidAt: { gte: startLastMonth, lte: endLastMonth },
        },
        _sum: { amountCents: true },
      }),
      prisma.client.count({
        where: {
          tenantId: tid,
          deletedAt: null,
          status: 'ACTIVE',
          createdAt: { lt: startThisMonth },
        },
      }),
    ]);

    const outstandingCents = sentInvoicesAgg._sum.amountCents || 0;
    const revThis = paidThisMonth._sum.amountCents || 0;
    const revLast = paidLastMonth._sum.amountCents || 0;

    const trendRev =
      revLast === 0 ? (revThis > 0 ? 'up' : 'flat') : revThis > revLast ? 'up' : revThis < revLast ? 'down' : 'flat';
    const trendClients =
      activeClients > prevActiveClients ? 'up' : activeClients < prevActiveClients ? 'down' : 'flat';

    const kpis = [
      {
        key: 'active_clients',
        label: 'Actieve klanten',
        value: String(activeClients),
        trend: trendClients,
        trendLabel:
          trendClients === 'flat' ? 'vs start maand' : trendClients === 'up' ? 'meer dan start maand' : 'minder dan start maand',
        hint: null,
      },
      {
        key: 'active_projects',
        label: 'Actieve projecten',
        value: String(activeProjects),
        trend: 'flat',
        trendLabel: 'PLANNED + ACTIVE + BLOCKED',
        hint: null,
      },
      {
        key: 'open_tasks',
        label: 'Open taken',
        value: String(openTasks),
        trend: 'flat',
        trendLabel: 'niet afgerond',
        hint: null,
      },
      {
        key: 'outstanding',
        label: 'Openstaand (facturen)',
        value: eur(outstandingCents),
        trend: overdueInvoicesCount > 0 ? 'down' : 'flat',
        trendLabel: overdueInvoicesCount > 0 ? `${overdueInvoicesCount} te laat` : 'geen achterstand',
        hint: 'SENT + OVERDUE',
      },
      {
        key: 'monthly_revenue',
        label: 'Omzet deze maand',
        value: eur(revThis),
        trend: trendRev,
        trendLabel: trendRev === 'flat' ? 'vs vorige maand' : trendRev === 'up' ? 'hoger dan vorige maand' : 'lager dan vorige maand',
        hint: 'betaalde facturen',
      },
      {
        key: 'overdue_invoices',
        label: 'Achterstallige facturen',
        value: String(overdueInvoicesCount),
        trend: 'flat',
        trendLabel: 'SENT vervallen + OVERDUE',
        hint: null,
      },
    ];

    const urgentTasks = await prisma.task.findMany({
      where: {
        tenantId: tid,
        deletedAt: null,
        status: { not: 'DONE' },
        OR: [{ priority: 'URGENT' }, { dueDate: { lte: eod } }],
      },
      take: 8,
      orderBy: [{ dueDate: 'asc' }],
      include: {
        client: { select: { companyName: true } },
        project: { select: { title: true } },
      },
    });

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        tenantId: tid,
        deletedAt: null,
        OR: [{ status: 'OVERDUE' }, { AND: [{ status: 'SENT' }, { dueDate: { lt: sod } }] }],
      },
      take: 8,
      include: { client: { select: { companyName: true } } },
    });

    const projectsNearDeadline = await prisma.project.findMany({
      where: {
        tenantId: tid,
        deletedAt: null,
        status: { not: 'COMPLETED' },
        deadline: { gte: sod, lte: in7d },
      },
      take: 8,
      include: { client: { select: { companyName: true } } },
    });

    const meetingsToday = await prisma.meeting.findMany({
      where: {
        tenantId: tid,
        startsAt: { gte: sod, lte: eod },
      },
      take: 8,
      include: { client: { select: { companyName: true } } },
    });

    const actions = [];

    for (const t of urgentTasks) {
      const meta = [
        t.dueDate ? `deadline ${new Date(t.dueDate).toLocaleDateString('nl-BE')}` : null,
        t.client?.companyName,
        t.project?.title,
        t.priority === 'URGENT' ? 'URGENT' : null,
      ]
        .filter(Boolean)
        .join(' · ');
      actions.push({
        id: `task-${t.id}`,
        title: t.title,
        meta,
        severity: t.priority === 'URGENT' || (t.dueDate && new Date(t.dueDate) < now) ? 'urgent' : 'warning',
      });
    }

    for (const inv of overdueInvoices) {
      actions.push({
        id: `inv-${inv.id}`,
        title: `Factuur ${inv.number}`,
        meta: `${eur(inv.amountCents)} · verval ${new Date(inv.dueDate).toLocaleDateString('nl-BE')}${inv.client ? ` · ${inv.client.companyName}` : ''}`,
        severity: 'warning',
      });
    }

    for (const p of projectsNearDeadline) {
      actions.push({
        id: `proj-${p.id}`,
        title: p.title,
        meta: `Deadline ${p.deadline ? new Date(p.deadline).toLocaleDateString('nl-BE') : '—'}${p.client ? ` · ${p.client.companyName}` : ''} · ${p.progress}%`,
        severity: 'warning',
      });
    }

    for (const m of meetingsToday) {
      actions.push({
        id: `meet-${m.id}`,
        title: m.title || 'Meeting',
        meta: `${new Date(m.startsAt).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}${m.client ? ` · ${m.client.companyName}` : ''}`,
        severity: 'info',
      });
    }

    const logs = await prisma.activityLog.findMany({
      where: { tenantId: tid },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { actor: { select: { name: true, email: true } } },
    });

    const activity = logs.map((log) => {
      const who = log.actor?.name || log.actor?.email || 'Systeem';
      let text = `${who} · ${log.action}`;
      if (log.metadata && typeof log.metadata === 'object' && log.metadata.companyName) {
        text = `${who} · ${log.action} (${log.metadata.companyName})`;
      }
      if (log.metadata && typeof log.metadata === 'object' && log.metadata.number) {
        text = `${who} · ${log.action} (${log.metadata.number})`;
      }
      return {
        id: log.id,
        text,
        time: relTime(log.createdAt),
      };
    });

    res.json({ kpis, actions, activity, tenant: { name: tenant.name, slug: tenant.slug } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: { code: 'DASHBOARD_FAILED', message: 'Kon dashboard niet bouwen.' } });
  }
});
