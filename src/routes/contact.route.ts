import { type IRouter, Router } from "subatom";
import {
  clientContactSchema,
  getClientContactSchema,
} from "../schema/contactUs.schema.js";
import clientContactFormController from "../controllers/contact-us/clientContactForm.controller.js";
import fetchContactEnqueryController from "../controllers/contact-us/fetchContactEnquery.controller.js";

const contactEnqueryRouter: IRouter = new Router();

// POST /payment/create-order
contactEnqueryRouter.post("/submit-record", {
  name: "enquery.submit",
  tags: ["Contact"],
  schema: clientContactSchema,
  controller: clientContactFormController,
});

contactEnqueryRouter.get("/fetch-all/records/:enqueryId", {
  name: "fetch.records",
  tags: ["Contact"],
  schema: getClientContactSchema,
  controller: fetchContactEnqueryController,
});

export default contactEnqueryRouter;
