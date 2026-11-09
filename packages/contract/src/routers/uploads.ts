import { oc } from '@orpc/contract'
import {
  createPresignedUploadInputSchema,
  createPresignedUploadOutputSchema,
  uploadIdInputSchema,
  uploadSchema,
  uploadUrlSchema,
} from '../schemas/uploads'

export const uploadsContract = {
  createPresignedUpload: oc
    .input(createPresignedUploadInputSchema)
    .output(createPresignedUploadOutputSchema),
  confirm: oc.input(uploadIdInputSchema).output(uploadSchema),
  getUrl: oc.input(uploadIdInputSchema).output(uploadUrlSchema),
}
