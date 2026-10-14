import { describe, expect, it } from "vitest";
import { generateOpenApiSpec } from "subatom";
import resumeRouter from "../src/routes/resume.route.js";

describe("resume OpenAPI documentation", () => {
  it("documents one avatar field and three document-file arrays", () => {
    const spec = generateOpenApiSpec(resumeRouter.getRoutes());
    const upload = spec.paths["/upload-resume"]?.post;
    const reference = upload?.requestBody?.content["multipart/form-data"]
      ?.schema?.$ref;
    const name = reference?.split("/").at(-1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components:any = spec.components;

    expect(components).toBeDefined();
    expect(name).toBeDefined();

    if (!components || !name) {
      throw new Error("The upload route did not generate an OpenAPI schema.");
    }

    const schema =  components.schemas[name];

    expect(schema?.properties?.avatar).toMatchObject({
      type: "string",
      format: "binary",
    });

    for (const field of [
      "certificateFiles",
      "publicationFiles",
      "achievementFiles",
    ]) {
      expect(schema?.properties?.[field]).toMatchObject({
        type: "array",
        items: { type: "string", format: "binary" },
      });
    }
  });
});
