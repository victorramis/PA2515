using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Web;

namespace CanteenManagemenWebApp.Models
{
    public class OrderItem
    {
        [Key]
        [DatabaseGeneratedAttribute(DatabaseGeneratedOption.Identity)]
        public int OrderItemId { get; set; }
        [Required]
        public int MenuItemId { get; set; }
        [Required]
        public int OrderId { get; set; }
        [Required]
        public int Quantity { get; set; }
    }
    public class OrderItemDTO
    {
        public OrderItemDTO(OrderItem order)
        {
            this.MenuItemId = order.MenuItemId;
            this.OrderItemId = order.OrderItemId;
            this.OrderId = order.OrderId;
            this.Quantity = order.Quantity; 
        }
        public int OrderItemId { get; set; }
        public int MenuItemId { get; set; }
        public int OrderId { get; set; }
        public MenuItem MenuItem{get;set;}
        public int Quantity { get; set; }
    }
}