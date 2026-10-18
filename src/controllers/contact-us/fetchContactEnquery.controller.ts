import { IController } from "subatom";
import { getClientContactSchema } from "../../schema/contactUs.schema.js";
import ContactEnqueryModel from "../../models/contactUs.js";

const fetchContactEnqueryController: IController<
  typeof getClientContactSchema
> = async (ctx) => {
  const { enqueryId } = ctx.params;

  if (enqueryId) {
    try {
      const findEnquery = await ContactEnqueryModel.findById(enqueryId);

      if (!findEnquery) {
        return ctx.helper.not_found("Requested enquery record does not exist.");
      } else {
        return ctx.response.status(200).json(findEnquery);
      }
    } catch (error: unknown) {
      return ctx.helper.internal_server_error((error as Error).message);
    }
  } else {
    try {
      const selectAllRecord = await ContactEnqueryModel.find();

      return ctx.response.status(200).json(selectAllRecord);
    } catch (error: unknown) {
      return ctx.helper.internal_server_error((error as Error).message);
    }
  }
};

export default fetchContactEnqueryController;
