/**
 * Orion demo seed — run after: npx prisma migrate dev
 * Usage: npm run db:seed
 *
 * Demo login (alle demo-users): wachtwoord = Demo2026!Orion
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD_HASH = bcrypt.hashSync("Demo2026!Orion", 12);

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-acme" },
    create: {
      name: "Acme Services BV",
      slug: "demo-acme",
      plan: "growth",
      settings: { timezone: "Europe/Brussels" },
    },
    update: {},
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.orion.app" },
    create: {
      email: "owner@demo.orion.app",
      name: "Alex Admin",
      passwordHash: DEMO_PASSWORD_HASH,
    },
    update: { name: "Alex Admin", passwordHash: DEMO_PASSWORD_HASH },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@demo.orion.app" },
    create: {
      email: "manager@demo.orion.app",
      name: "Morgan Manager",
      passwordHash: DEMO_PASSWORD_HASH,
    },
    update: { passwordHash: DEMO_PASSWORD_HASH },
  });

  const finance = await prisma.user.upsert({
    where: { email: "finance@demo.orion.app" },
    create: {
      email: "finance@demo.orion.app",
      name: "Frank Finance",
      passwordHash: DEMO_PASSWORD_HASH,
    },
    update: { passwordHash: DEMO_PASSWORD_HASH },
  });

  await prisma.membership.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: owner.id },
    },
    create: {
      tenantId: tenant.id,
      userId: owner.id,
      role: "OWNER",
      acceptedAt: new Date(),
    },
    update: { role: "OWNER", acceptedAt: new Date() },
  });

  await prisma.membership.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: manager.id },
    },
    create: {
      tenantId: tenant.id,
      userId: manager.id,
      role: "MANAGER",
      acceptedAt: new Date(),
    },
    update: {},
  });

  await prisma.membership.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: finance.id },
    },
    create: {
      tenantId: tenant.id,
      userId: finance.id,
      role: "FINANCE",
      acceptedAt: new Date(),
    },
    update: {},
  });

  const tagConsulting = await prisma.tag.upsert({
    where: {
      tenantId_slug: { tenantId: tenant.id, slug: "consulting" },
    },
    create: {
      tenantId: tenant.id,
      name: "Consulting",
      slug: "consulting",
    },
    update: {},
  });

  const clientA = await prisma.client.create({
    data: {
      tenantId: tenant.id,
      companyName: "Northwind Traders",
      contactName: "Jan Janssen",
      email: "jan@northwind.example",
      phone: "+32 2 123 45 67",
      city: "Brussel",
      country: "BE",
      vatNumber: "BE0123456789",
      status: "ACTIVE",
      accountManagerId: manager.id,
      lastContactAt: new Date(),
      tags: {
        create: { tagId: tagConsulting.id },
      },
    },
  });

  const clientB = await prisma.client.create({
    data: {
      tenantId: tenant.id,
      companyName: "Contoso Labs",
      contactName: "Sam De Smet",
      email: "sam@contoso.example",
      status: "PROSPECT",
      accountManagerId: manager.id,
    },
  });

  const project = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      clientId: clientA.id,
      title: "Website redesign Q2",
      status: "ACTIVE",
      startDate: new Date("2026-03-01"),
      deadline: new Date("2026-04-30"),
      progress: 45,
      priority: "HIGH",
      members: {
        create: [{ userId: manager.id }, { userId: owner.id }],
      },
    },
  });

  const taskUrgent = await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project.id,
      clientId: clientA.id,
      title: "Approve wireframes",
      status: "TODO",
      priority: "URGENT",
      dueDate: new Date("2026-04-14"),
      assigneeId: owner.id,
    },
  });

  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project.id,
      title: "Implement design system",
      status: "IN_PROGRESS",
      priority: "NORMAL",
      dueDate: new Date("2026-04-20"),
      assigneeId: manager.id,
    },
  });

  const meeting = await prisma.meeting.create({
    data: {
      tenantId: tenant.id,
      clientId: clientA.id,
      projectId: project.id,
      title: "Weekly sync",
      startsAt: new Date("2026-04-12T10:00:00Z"),
      endsAt: new Date("2026-04-12T10:45:00Z"),
      summary: "Reviewed milestones and blockers.",
      decisions: "Move launch by one week.",
      participants: {
        create: [
          { userId: manager.id },
          { userId: owner.id },
          { guestName: "Jan Janssen", guestEmail: "jan@northwind.example" },
        ],
      },
      actionItems: {
        create: [{ title: "Send revised timeline to client" }, { title: "Update project budget" }],
      },
    },
  });

  const invOpen = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      clientId: clientA.id,
      projectId: project.id,
      number: "INV-2026-0042",
      status: "SENT",
      amountCents: 125000,
      currency: "EUR",
      issueDate: new Date("2026-04-01"),
      dueDate: new Date("2026-04-15"),
    },
  });

  const invPaid = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      clientId: clientB.id,
      number: "INV-2026-0043",
      status: "PAID",
      amountCents: 480000,
      currency: "EUR",
      issueDate: new Date("2026-03-01"),
      dueDate: new Date("2026-03-15"),
      paidAt: new Date("2026-03-10"),
    },
  });

  await prisma.activityLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        actorId: manager.id,
        entityType: "CLIENT",
        entityId: clientA.id,
        action: "client.created",
        metadata: { companyName: clientA.companyName },
      },
      {
        tenantId: tenant.id,
        actorId: owner.id,
        entityType: "INVOICE",
        entityId: invOpen.id,
        action: "invoice.sent",
        metadata: { number: invOpen.number },
      },
      {
        tenantId: tenant.id,
        actorId: manager.id,
        entityType: "PROJECT",
        entityId: project.id,
        action: "project.updated",
        metadata: { title: project.title, progress: project.progress },
      },
    ],
  });

  await prisma.notification.create({
    data: {
      tenantId: tenant.id,
      userId: owner.id,
      type: "TASK_DUE",
      title: "Task due soon",
      body: "Approve wireframes is due tomorrow.",
      entityType: "TASK",
      entityId: taskUrgent.id,
    },
  });

  console.log(
    "Seed OK — tenant:",
    tenant.slug,
    "meeting:",
    meeting.id,
    "invoices:",
    invOpen.id,
    invPaid.id
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
