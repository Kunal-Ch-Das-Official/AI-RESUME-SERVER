import s from"../../models/usersData.js";const o=async e=>{try{if(e.params.userId){const r=await s.findById(e.params.userId);return r?e.helper.success(r):e.helper.not_found("Requested user not found..")}else{const r=await s.find();return e.helper.success(r)}}catch(r){return e.helper.internal_server_error(r.message)}};var u=o;export{u as default};
//# sourceMappingURL=fetchUsers.controller.js.map
