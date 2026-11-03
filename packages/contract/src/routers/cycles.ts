import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  cycleDetailSchema,
  cycleIdInputSchema,
  cycleSchema,
  listCyclesInputSchema,
  updateCycleInputSchema,
} from '../schemas/cycles'

export const cyclesContract = {
  // Bounded per team (a few per quarter), so a plain array: current, upcoming, past.
  list: oc.input(listCyclesInputSchema).output(z.array(cycleSchema)),
  get: oc.input(cycleIdInputSchema).output(cycleDetailSchema),
  update: oc.input(updateCycleInputSchema).output(cycleDetailSchema),
}
