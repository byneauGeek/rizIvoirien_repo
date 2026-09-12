-- AlterTable
ALTER TABLE "PlatformSettings" ALTER COLUMN "basicMaxProducts" SET DEFAULT 50;


-- LOT PLANS (retour utilisateur) : aligne aussi la valeur DÉJÀ EN BASE
-- (singleton id=1) sur la nouvelle promesse "jusqu'à 50 produits" — sans
-- ce data-fix, seules les installations FUTURES auraient hérité du bon
-- défaut, laissant la production actuelle silencieusement illimitée. Ne
-- touche que la valeur encore à son ancien défaut (0) : un admin qui aurait
-- déjà personnalisé cette limite n'est jamais écrasé.
UPDATE "PlatformSettings" SET "basicMaxProducts" = 50 WHERE "basicMaxProducts" = 0;
