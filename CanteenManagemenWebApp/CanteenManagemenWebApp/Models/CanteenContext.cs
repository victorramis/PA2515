using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Web;

namespace CanteenManagemenWebApp.Models
{
    public class CanteenContext : DbContext
    {
        public CanteenContext()
            : base("CanteenConnection")
        {
        }

        public DbSet<UserProfile> UserProfiles { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<MenuItem> MenuItems { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }

        public DbSet<Statistics> Statistics { get; set; }
    }

}