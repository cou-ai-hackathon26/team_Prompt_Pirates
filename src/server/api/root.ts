import { cbcRouter } from "~/server/api/routers/cbc";
import { checkinRouter } from "~/server/api/routers/checkin";
import { dashboardRouter } from "~/server/api/routers/dashboard";
import { accountRouter } from "~/server/api/routers/account";
import { fluidRouter } from "~/server/api/routers/fluid";
import { hospitalRouter } from "~/server/api/routers/hospital";
import { patientRouter } from "~/server/api/routers/patient";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  patient: patientRouter,
  checkin: checkinRouter,
  cbc: cbcRouter,
  dashboard: dashboardRouter,
  fluid: fluidRouter,
  account: accountRouter,
  hospital: hospitalRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
