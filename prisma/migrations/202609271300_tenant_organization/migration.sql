-- Реквизиты сервиса раньше лежали в коде (tenant-requisites.data.ts), и тенант без записи
-- получал реквизиты «Автомагистра». Теперь юр. часть — это организации, привязанные к сервису,
-- а торговая марка (логотип, контакты, подвал печати) — ключи настроек.

-- Перенос данных: либо целиком, либо никак.
BEGIN;

ALTER TABLE "organization" ADD COLUMN "requisite_head" VARCHAR(255);
ALTER TABLE "organization" ADD COLUMN "requisite_head_position" VARCHAR(255);

-- У сервиса может быть несколько юр. лиц (ИП и ООО на одной точке), одно из них основное.
-- Единственность основной держит сервис: частичный уникальный индекс Prisma не описывает.
CREATE TABLE "tenant_organization" (
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(0) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "tenant_organization_pkey" PRIMARY KEY ("tenant_id", "organization_id")
);

CREATE INDEX "idx_tenant_organization_organization_id" ON "tenant_organization"("organization_id");

ALTER TABLE "tenant_organization" ADD CONSTRAINT "tenant_organization_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "tenant_organization" ADD CONSTRAINT "tenant_organization_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TEMPORARY TABLE "tmp_tenant_requisites" (
    "identifier" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "legal_address" VARCHAR(255) NOT NULL,
    "inn" VARCHAR(12) NOT NULL,
    "ogrn" VARCHAR(15),
    "bank" VARCHAR(255),
    "rs" VARCHAR(20),
    "ks" VARCHAR(20),
    "bik" VARCHAR(9),
    "head" VARCHAR(255),
    "head_position" VARCHAR(255),
    "service_address" VARCHAR(255),
    "site" VARCHAR(255),
    "email" VARCHAR(255),
    "telephones" JSONB NOT NULL,
    "logo_url" VARCHAR(512),
    "guaranty_url" VARCHAR(512)
);

INSERT INTO "tmp_tenant_requisites" VALUES
    (
        'demo', 'ИП Сидоров Кирилл Михайлович', 'г. Москва, Нагатинская наб., д. 14, к. 1, кв. 407',
        '166016686002', '324774600492011', 'ООО "Банк Точка"',
        '40802810620000372884', '30101810745374525104', '044525104',
        'Сидоров К.М.', 'Индивидуальный предприниматель', NULL,
        'www.automagistre.ru', 'info@automagistre.ru', '["+7 (495) 984-81-82", "+7 (985) 929-40-87"]',
        '/img/logo_automagistre_color.png', 'https://www.automagistre.ru/gr'
    ),
    (
        'msk', 'ИП Сидоров Кирилл Михайлович', 'г. Москва, Нагатинская наб., д. 14, к. 1, кв. 407',
        '166016686002', '324774600492011', 'ООО "Банк Точка"',
        '40802810620000372884', '30101810745374525104', '044525104',
        'Сидоров К.М.', 'Индивидуальный предприниматель', 'г. Москва, ул. Газопровод, д. 6А, стр.2',
        'www.automagistre.ru', 'info@automagistre.ru', '["+7 (495) 984-81-82", "+7 (985) 929-40-87"]',
        '/img/logo_automagistre_color.png', 'https://www.automagistre.ru/gr'
    ),
    (
        'kazan', 'ИП Ахметзянов А.А.', 'г. Казань, Магистральная 33 к.1',
        '166017663015', '318169000126792', 'АО «Тинькофф Банк»',
        '40802810500000686477', '30101810145250000974', '044525974',
        'Ахметзянов А.А.', 'Индивидуальный предприниматель', NULL,
        'www.automagistre.ru', 'info@automagistre.ru', '["+7 (966) 260-10-90", "+7 (927) 244-48-68"]',
        '/img/logo_automagistre_color.png', 'https://www.automagistre.ru/gr'
    ),
    (
        'shavlev', 'ИП Щавлев В.А.', 'Моск. обл., Орехово-Зуевский район, п. Пригородный, Малодубенское шоссе, 3 км, цех № 1',
        '507303160627', NULL, 'ПАО СБЕРБАНК',
        '40802810940000009848', '30101810400000000225', '044525225',
        'Щавлев В.А.', 'Индивидуальный предприниматель', NULL,
        'vk.com/smitavtoservis', NULL, '["+7 (926) 214-56-65"]',
        '/img/logo_smith.png', 'https://vk.com/topic-51443133_40629700'
    );

-- Организация с тем же ИНН в группе сервиса уже может быть заведена — тогда дополняем её.
UPDATE "organization" o
SET "requisite_head" = COALESCE(o."requisite_head", r."head"),
    "requisite_head_position" = COALESCE(o."requisite_head_position", r."head_position")
FROM "tmp_tenant_requisites" r
JOIN "tenant" t ON t."identifier" = r."identifier"
WHERE o."tenant_group_id" = t."group_id" AND o."requisite_inn" = r."inn";

-- created_by явно: умолчание колонки читает app.user_id, которого у миграции нет.
INSERT INTO "organization" (
    "id", "name", "address", "contractor", "seller", "tenant_group_id", "created_by",
    "requisite_bank", "requisite_legal_address", "requisite_ogrn", "requisite_inn",
    "requisite_rs", "requisite_ks", "requisite_bik", "requisite_head", "requisite_head_position"
)
SELECT DISTINCT ON (t."group_id", r."inn")
       gen_random_uuid(), r."name", r."legal_address", false, false, t."group_id", NULL,
       r."bank", r."legal_address", r."ogrn", r."inn",
       r."rs", r."ks", r."bik", r."head", r."head_position"
FROM "tmp_tenant_requisites" r
JOIN "tenant" t ON t."identifier" = r."identifier"
WHERE NOT EXISTS (
    SELECT 1 FROM "organization" o
    WHERE o."tenant_group_id" = t."group_id" AND o."requisite_inn" = r."inn"
);

INSERT INTO "tenant_organization" ("tenant_id", "organization_id", "is_default")
SELECT t."id", o."id", true
FROM "tmp_tenant_requisites" r
JOIN "tenant" t ON t."identifier" = r."identifier"
JOIN LATERAL (
    SELECT o."id" FROM "organization" o
    WHERE o."tenant_group_id" = t."group_id" AND o."requisite_inn" = r."inn"
    ORDER BY o."created_at" NULLS LAST, o."id"
    LIMIT 1
) o ON true
ON CONFLICT DO NOTHING;

-- Торговая марка. Город в договоре хранения был зашит как «г. Москва» для всех — переносим как есть.
INSERT INTO "setting" ("tenant_id", "key", "value")
SELECT t."id", v."key", v."value"
FROM "tmp_tenant_requisites" r
JOIN "tenant" t ON t."identifier" = r."identifier"
CROSS JOIN LATERAL (VALUES
    ('brandLogoUrl', to_jsonb(r."logo_url")),
    ('brandSite', to_jsonb(r."site")),
    ('brandEmail', to_jsonb(r."email")),
    ('brandTelephones', r."telephones"),
    ('brandServiceAddress', to_jsonb(r."service_address")),
    ('brandContractCity', to_jsonb('г. Москва'::text)),
    ('brandGuarantyUrl', to_jsonb(r."guaranty_url")),
    ('brandPrintFooterImageUrl', to_jsonb('/img/print_form_footer.png'::text))
) AS v("key", "value")
WHERE v."value" IS NOT NULL AND v."value" <> 'null'::jsonb
ON CONFLICT ("tenant_id", "key") DO NOTHING;

DROP TABLE "tmp_tenant_requisites";

COMMIT;
