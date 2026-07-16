from sitecms.roles import is_admin as _is_admin


def user_is_admin(request):
    # Une seule définition d'« admin » dans le projet : celle de sitecms.roles.
    # Cette copie testait « le nom du groupe contient admin », ce qui acceptait
    # n'importe quel groupe fabriqué (« None_Admin »). Deux règles divergentes,
    # c'est une des deux qui finit par être la faille.
    return {"is_admin": _is_admin(request.user)}
