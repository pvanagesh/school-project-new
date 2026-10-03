from rest_framework.routers import DefaultRouter

from .views import (
    FeeCategoryViewSet,
    FeeStructureViewSet,
    PaymentAdjustmentViewSet,
    PaymentViewSet,
)

router = DefaultRouter()
router.register("fee-categories", FeeCategoryViewSet)
router.register("fee-structures", FeeStructureViewSet)
router.register("payments", PaymentViewSet)
router.register("payment-adjustments", PaymentAdjustmentViewSet)

urlpatterns = router.urls
