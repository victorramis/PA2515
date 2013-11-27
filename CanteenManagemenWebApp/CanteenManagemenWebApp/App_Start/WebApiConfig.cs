using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;

namespace CanteenManagemenWebApp
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}/{otherId}/{details}",
                defaults: new { id = RouteParameter.Optional, otherId = RouteParameter.Optional, details = RouteParameter.Optional }
            );
        }
    }
}
