// Normalizes PostgreSQL snake_case grading-scheme rows into the camelCase UI model.
(() => {
  if (typeof api !== 'function') return;
  const originalApi = api;
  const normalizeSub = s => ({...s,subcomponentKey:s.subcomponentKey??s.subcomponent_key,weightShare:s.weightShare??Number(s.weight_share),sourceFilter:s.sourceFilter??s.source_filter,isActive:s.isActive??s.is_active});
  const normalizeComponent = c => ({...c,componentKey:c.componentKey??c.component_key,sourceType:c.sourceType??c.source_type,calculationMethod:c.calculationMethod??c.calculation_method,maxPoints:c.maxPoints??(c.max_points==null?null:Number(c.max_points)),isActive:c.isActive??c.is_active,subcomponents:(c.subcomponents||[]).map(normalizeSub)});
  const normalizeScheme = s => s ? {...s,classId:s.classId??s.class_id,createdBy:s.createdBy??s.created_by,components:(s.components||[]).map(normalizeComponent)} : s;
  api = async function(method,path,body){const result=await originalApi(method,path,body);if(String(path).startsWith('/grading-schemes/')&&result&&Object.prototype.hasOwnProperty.call(result,'scheme'))return {...result,scheme:normalizeScheme(result.scheme)};return result;};
})();
