using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Web;

namespace CanteenManagemenWebApp.Models
{
    public class Statistics
    {
        [Key]
        [DatabaseGeneratedAttribute(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public int TotalNumberOfUsers { get; set; }
        public int TotalNumberOfOrders { get; set; }
        public int TotalSalesToday { get; set; }
        public int TotalSaleValueToday { get; set; }
        public int TotalSalesThisMonth { get; set; }
        public int TotalSaleValueThisMonth { get; set; } 
    }
}