"""Tests du parcours public : checkout panier (tous les chemins) + correction
des 6 types de quiz. Filet de non-régression pour la refonte des parcours."""
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, TestCase

from bucket.models import Inscription, Order
from contents.models import Category, Publication

CHECKOUT_URL = "/api/v1/site/panier/checkout/"


def make_pub(title="Formation Test", price="1000.00", capacite=None, is_private=False):
    cat, _ = Category.objects.get_or_create(name="Cat test")
    return Publication.objects.create(
        title=title, description="desc", price=Decimal(price),
        categorie=cat, is_private=is_private, capacite=capacite,
    )


class CheckoutTests(TestCase):
    """Couvre le happy path, la synchro de comptes, la commande gratuite, la
    capacité, et les chemins d'erreur (validation, personnel, déjà inscrit)."""

    def setUp(self):
        cache.clear()  # neutralise le throttle anti-abus entre les tests
        self.client = Client()
        self.pub = make_pub(price="1000.00")

    def post(self, payload):
        return self.client.post(CHECKOUT_URL, data=payload, content_type="application/json")

    def test_creates_order_inscription_account_address(self):
        r = self.post({
            "acheteur": {"email": "parent@ex.com", "first_name": "Awa", "last_name": "P"},
            "adresse": {"telephone": "690000001", "ville": "Douala"},
            "items": [{"formation_id": self.pub.id, "participant": {"first_name": "Enf", "email": "enf@ex.com"}}],
        })
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()
        self.assertIn("order_token", data)
        self.assertEqual(data["nb_lignes"], 1)
        order = Order.objects.get(pk=data["order_id"])
        self.assertEqual(order.status, Order.PENDING)
        self.assertTrue(
            Inscription.objects.filter(publication=self.pub, status=Inscription.WAITING).exists()
        )
        self.assertTrue(User.objects.filter(email="enf@ex.com").exists())
        self.assertTrue(User.objects.filter(email="parent@ex.com").exists())
        from sitecms.models import AdresseCommande
        adr = AdresseCommande.objects.get(order=order)
        self.assertEqual(adr.ville, "Douala")
        self.assertEqual(adr.telephone, "690000001")

    def test_shared_email_distinct_children(self):
        r = self.post({
            "acheteur": {"email": "parent2@ex.com", "first_name": "B", "last_name": "P"},
            "items": [
                {"formation_id": self.pub.id, "participant": {"first_name": "Ada", "last_name": "F", "email": "foyer@ex.com"}},
                {"formation_id": self.pub.id, "participant": {"first_name": "Ben", "last_name": "F", "email": "foyer@ex.com"}},
            ],
        })
        self.assertEqual(r.status_code, 201, r.content)
        # Deux enfants sous la même adresse → deux comptes distincts (lien magique).
        self.assertEqual(User.objects.filter(email="foyer@ex.com").count(), 2)
        self.assertEqual(r.json()["nb_lignes"], 2)

    def test_existing_account_reused(self):
        existing = User.objects.create(
            username="v@ex.com", email="v@ex.com", first_name="Victor", last_name="E"
        )
        r = self.post({
            "acheteur": {"email": "buyer3@ex.com", "first_name": "C", "last_name": "P"},
            "items": [{"formation_id": self.pub.id, "participant": {"first_name": "Victor", "last_name": "E", "email": "v@ex.com"}}],
        })
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(User.objects.filter(email="v@ex.com").count(), 1)
        self.assertTrue(Inscription.objects.filter(publication=self.pub, participant=existing).exists())

    def test_free_order_confirmed_immediately(self):
        free = make_pub(title="Gratuite", price="0.00")
        r = self.post({
            "acheteur": {"email": "p4@ex.com", "first_name": "D", "last_name": "P"},
            "items": [{"formation_id": free.id, "participant": {"first_name": "E", "email": "e4@ex.com"}}],
        })
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.json()["paid"])
        self.assertTrue(
            Inscription.objects.filter(publication=free, status=Inscription.CONFIRMED).exists()
        )

    def test_capacity_full_returns_409(self):
        cap = make_pub(title="Complète", price="500.00", capacite=1)
        occupant = User.objects.create(username="occ@ex.com", email="occ@ex.com")
        Inscription.objects.create(participant=occupant, publication=cap, status=Inscription.WAITING)
        r = self.post({
            "acheteur": {"email": "p5@ex.com", "first_name": "F", "last_name": "P"},
            "items": [{"formation_id": cap.id, "participant": {"first_name": "G", "email": "g5@ex.com"}}],
        })
        self.assertEqual(r.status_code, 409, r.content)

    def test_invalid_buyer_email_400(self):
        r = self.post({
            "acheteur": {"email": "pasunemail", "first_name": "X"},
            "items": [{"formation_id": self.pub.id, "pour_moi": True}],
        })
        self.assertEqual(r.status_code, 400)

    def test_missing_first_name_400(self):
        r = self.post({
            "acheteur": {"email": "p6@ex.com"},
            "items": [{"formation_id": self.pub.id, "pour_moi": True}],
        })
        self.assertEqual(r.status_code, 400)

    def test_empty_cart_400(self):
        r = self.post({"acheteur": {"email": "p7@ex.com", "first_name": "H"}, "items": []})
        self.assertEqual(r.status_code, 400)

    def test_staff_email_buyer_rejected_400(self):
        User.objects.create(username="admin_x", email="admin_x@ex.com", is_staff=True)
        r = self.post({
            "acheteur": {"email": "admin_x@ex.com", "first_name": "I"},
            "items": [{"formation_id": self.pub.id, "pour_moi": True}],
        })
        self.assertEqual(r.status_code, 400)

    def test_already_confirmed_only_line_409(self):
        u = User.objects.create(username="done@ex.com", email="done@ex.com", first_name="J", last_name="K")
        Inscription.objects.create(participant=u, publication=self.pub, status=Inscription.CONFIRMED)
        r = self.post({
            "acheteur": {"email": "buyer8@ex.com", "first_name": "L", "last_name": "M"},
            "items": [{"formation_id": self.pub.id, "participant": {"first_name": "J", "last_name": "K", "email": "done@ex.com"}}],
        })
        # La seule ligne est déjà confirmée → rien de neuf à enregistrer → 409.
        self.assertEqual(r.status_code, 409, r.content)


class QuizScoringTests(TestCase):
    """Correction typée des 6 kinds : tout juste = score plein, tout faux = 0."""

    @classmethod
    def setUpTestData(cls):
        from lessonapp.models import Activity, Activityquestion, Question, Seance, Theme
        from lessonapp.models.bloc import Bloc
        from material.models import InputQuestionBox

        cls.user = User.objects.create(username="u@ex.com", email="u@ex.com")
        theme = Theme.objects.create(title="T")
        seance = Seance.objects.create(title="S", theme=theme)
        bloc_a = Bloc.objects.create(title="A", created_by=cls.user, categorie=Bloc.ACTIVITY)
        cls.activity = Activity.objects.create(
            title="Quiz", seance=seance, bloc=bloc_a, a_type=Activity.QUIZZ
        )

        def add_q(kind, boxes, points=2):
            bloc = Bloc.objects.create(title="Q", created_by=cls.user, categorie=Bloc.QUESTION)
            q = Question.objects.create(title="Q?", description="", bloc=bloc, kind=kind)
            Activityquestion.objects.create(activity=cls.activity, question=q, points=points, number=0)
            for title, is_ans in boxes:
                InputQuestionBox.objects.create(question=q, title=title, is_answer=is_ans, input_type=2)
            return q

        cls.q_qcm = add_q(Question.QCM, [("A", True), ("B", False), ("C", False)])
        cls.q_tf = add_q(Question.TRUE_FALSE, [("Vrai", True), ("Faux", False)])
        cls.q_text = add_q(Question.FREE_TEXT, [("Yaoundé", True)])
        cls.q_num = add_q(Question.NUMERIC, [("3.14|0.01", True)])
        cls.q_assoc = add_q(Question.ASSOCIATION, [("Chat||Mammifère", True), ("Aigle||Oiseau", True)])
        cls.q_order = add_q(Question.ORDERING, [("1||Un", True), ("2||Deux", True)])

    def _boxes(self, q):
        from material.models import InputQuestionBox
        return list(InputQuestionBox.objects.filter(question=q).order_by("id"))

    def _correct(self, q):
        from material.models import InputQuestionBox
        return InputQuestionBox.objects.get(question=q, is_answer=True)

    def test_all_correct_full_score(self):
        from sitecms.learner import _score_quiz

        answers = {
            str(self.q_qcm.id): [self._correct(self.q_qcm).id],
            str(self.q_tf.id): [self._correct(self.q_tf).id],
            str(self.q_text.id): "yaounde",  # normalisé (sans accent/casse)
            str(self.q_num.id): "3.14",
            str(self.q_assoc.id): {
                str(b.id): b.title.partition("||")[2] for b in self._boxes(self.q_assoc)
            },
            str(self.q_order.id): [
                b.id for b in sorted(self._boxes(self.q_order), key=lambda b: int(b.title.split("||")[0]))
            ],
        }
        score, max_score, results = _score_quiz(self.activity, answers)
        self.assertEqual(len(results), 6)
        self.assertEqual(score, max_score)
        self.assertTrue(all(r["is_correct"] for r in results))

    def test_all_wrong_zero(self):
        from material.models import InputQuestionBox
        from sitecms.learner import _score_quiz

        assoc_boxes = self._boxes(self.q_assoc)
        order_boxes = sorted(self._boxes(self.q_order), key=lambda b: int(b.title.split("||")[0]))
        answers = {
            str(self.q_qcm.id): [InputQuestionBox.objects.filter(question=self.q_qcm, is_answer=False).first().id],
            str(self.q_tf.id): [InputQuestionBox.objects.filter(question=self.q_tf, is_answer=False).first().id],
            str(self.q_text.id): "Paris",
            str(self.q_num.id): "3.20",  # hors tolérance ±0.01
            # associations croisées
            str(self.q_assoc.id): {str(assoc_boxes[0].id): "Oiseau", str(assoc_boxes[1].id): "Mammifère"},
            # ordre inversé
            str(self.q_order.id): [b.id for b in reversed(order_boxes)],
        }
        score, _max, results = _score_quiz(self.activity, answers)
        self.assertEqual(score, 0)
        self.assertFalse(any(r["is_correct"] for r in results))
