DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'enterprise' AND enumtypid = 'subscription_plan'::regtype) THEN
    ALTER TYPE "public"."subscription_plan" ADD VALUE 'enterprise';
  END IF;
END $$;