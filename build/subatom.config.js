import{configEnv as e}from"subatom";e();import{defineConfig as o}from"subatom";var t=o({port:Number(process.env.PORT),host:process.env.HOST,outDir:"build",sourcemap:!0,minify:!0,entry:"main.ts",watch:{extensions:["ts","tsx","js","jsx"],debounceMs:500,ignore:["**/logs/**"]}});export{t as default};
//# sourceMappingURL=subatom.config.js.map
