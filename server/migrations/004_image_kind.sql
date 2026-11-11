-- Что показано на главном фото товара: иллюстрация, студийный рендер или настоящее фото.
-- Для рендеров на странице товара выводится пометка «иллюстративное изображение».
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_kind text NOT NULL DEFAULT 'illustration';
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_image_kind_check;
ALTER TABLE products ADD CONSTRAINT products_image_kind_check CHECK (image_kind IN ('illustration', 'render', 'photo'));
