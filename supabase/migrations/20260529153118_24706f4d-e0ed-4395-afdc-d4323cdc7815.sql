
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
  _slug text;
  _domain text;
  _first text;
  _last text;
  _meta_tenant text;
BEGIN
  -- 1) tenant_id explícito en metadata del signup
  _meta_tenant := NEW.raw_user_meta_data->>'tenant_id';
  IF _meta_tenant IS NOT NULL AND _meta_tenant ~* '^[0-9a-f-]{36}$' THEN
    _tenant := _meta_tenant::uuid;
  END IF;

  -- 2) por slug en metadata
  IF _tenant IS NULL THEN
    _slug := NEW.raw_user_meta_data->>'tenant_slug';
    IF _slug IS NOT NULL THEN
      SELECT id INTO _tenant FROM public.tenants WHERE slug = _slug LIMIT 1;
    END IF;
  END IF;

  -- 3) por dominio en metadata
  IF _tenant IS NULL THEN
    _domain := NEW.raw_user_meta_data->>'tenant_domain';
    IF _domain IS NOT NULL THEN
      SELECT id INTO _tenant FROM public.tenants WHERE domain = _domain LIMIT 1;
    END IF;
  END IF;

  -- 4) fallback: si solo existe un tenant en la BD (piloto), usarlo
  IF _tenant IS NULL THEN
    SELECT id INTO _tenant FROM public.tenants;
    IF (SELECT COUNT(*) FROM public.tenants) > 1 THEN
      _tenant := NULL;
    END IF;
  END IF;

  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar el club para el nuevo usuario %', NEW.email;
  END IF;

  _first := COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name',''), split_part(NEW.email,'@',1));
  _last  := COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name',''), '');

  INSERT INTO public.profiles (user_id, tenant_id, email, first_name, last_name)
  VALUES (NEW.id, _tenant, NEW.email, _first, _last)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
