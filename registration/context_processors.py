def user_is_admin(request):
    is_admin = False

    if request.user.is_authenticated:
        is_admin = request.user.groups.filter(name__icontains="admin").exists()

    return {
        "is_admin": is_admin
    }
